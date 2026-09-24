import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsGraphQLResponseError,
  FellowshipLogsReportChangedError,
  FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import {
  getFightResponseExpiresAt,
  getReportPageResponseExpiresAt,
  makeFellowshipLogsResponseKey,
} from "@frt/api/services/fellowship-logs/cache/fellowship-logs-cache-policy.ts";
import { FellowshipLogsResponseCache } from "@frt/api/services/fellowship-logs/cache/fellowship-logs-response-cache-service.ts";
import { streamFellowshipLogsEvents } from "@frt/api/services/fellowship-logs/events/stream-fellowship-logs-events.ts";
import { makeFellowshipLogsHttpQuery } from "@frt/api/services/fellowship-logs/fellowship-logs-http-query.ts";
import {
  deriveDungeonRunMetadata,
  findFightOrFail,
  getReportOrFail,
  getReportPageProgress,
  makeFellowshipLogsRateLimitDataTracker,
  makeTrackedQuery,
} from "@frt/api/services/fellowship-logs/fellowship-logs-response-helpers.ts";
import {
  type FellowshipLogsCredentials,
  type FellowshipLogsService,
  type GetCredentials,
  type Query,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@frt/api/services/fellowship-logs/query/get-dungeon-run-metadata-query.ts";
import { GET_FIGHT_QUERY } from "@frt/api/services/fellowship-logs/query/get-fight-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@frt/api/services/fellowship-logs/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@frt/api/services/fellowship-logs/query/report-query.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { FellowshipLogsDungeonRunMetadataResponseDataSchema } from "./validation/fellowship-logs-dungeon-run-metadata-schema.ts";
import { FellowshipLogsFightResponseDataSchema } from "./validation/fellowship-logs-fight-schema.ts";
import { FellowshipLogsReportResponseDataSchema } from "./validation/fellowship-logs-report-schema.ts";

type GetReportPageOptions = {
  readonly endTime: number;
  readonly fightId: FellowshipLogsFightId;
  readonly isCacheable: boolean;
  readonly reportCode: FellowshipLogsReportCode;
  readonly startTime: number;
};

export function makeFellowshipLogsServiceFromQuery(query: Query) {
  return E.gen(function* () {
    const responseCache = yield* FellowshipLogsResponseCache;
    const rateLimitTracker = yield* makeFellowshipLogsRateLimitDataTracker();
    const trackedQuery = makeTrackedQuery(query, rateLimitTracker);

    const getDungeonRunMetadata: FellowshipLogsService["getDungeonRunMetadata"] =
      E.fn("FellowshipLogs.getDungeonRunMetadata")(function* ({
        fightId,
        reportCode,
      }) {
        const responseData = yield* responseCache.cached(
          {
            fightId,
            getExpiresAt: (data, now) => {
              return getFightResponseExpiresAt({ data, fightId, now });
            },
            key: makeFellowshipLogsResponseKey("DUNGEON_RUN_METADATA", [
              reportCode,
              fightId,
            ]),
            operation: "DUNGEON_RUN_METADATA",
            reportCode,
            schema: FellowshipLogsDungeonRunMetadataResponseDataSchema,
          },
          trackedQuery(
            {
              query: makeQuery({
                name: "GetDungeonRunMetadata",
                selections: [
                  DUNGEON_RUN_METADATA_SELECTION,
                  RATE_LIMIT_DATA_SELECTION,
                ],
                variables: DUNGEON_RUN_METADATA_VARIABLES,
              }),
              variables: {
                fightId,
                reportCode,
              },
            },
            FellowshipLogsDungeonRunMetadataResponseDataSchema,
          ),
        );

        const metadata = yield* deriveDungeonRunMetadata({
          fightId,
          reportCode,
          responseData,
        });

        return {
          dungeonId: metadata.dungeonId,
          dungeonLevel: metadata.dungeonLevel,
          endedAt: DateTime.makeUnsafe(metadata.endedAtMilliseconds),
          isInProgress: metadata.isInProgress,
          startedAt: DateTime.makeUnsafe(metadata.startedAtMilliseconds),
        };
      });

    const getRateLimitData: FellowshipLogsService["getRateLimitData"] = (
      options,
    ) => {
      if (options?.force !== true) {
        return rateLimitTracker.getLastKnown();
      }

      return trackedQuery(
        {
          query: RATE_LIMIT_DATA_QUERY,
        },
        FellowshipLogsRateLimitResponseDataSchema,
        { skipCapacityCheck: true },
      ).pipe(E.andThen(rateLimitTracker.getLastKnown()));
    };

    const getFight = E.fn("FellowshipLogs.getFight")(function* ({
      fightId,
      reportCode,
    }: {
      readonly fightId: FellowshipLogsFightId;
      readonly reportCode: FellowshipLogsReportCode;
    }) {
      const responseData = yield* responseCache.cached(
        {
          fightId,
          getExpiresAt: (data, now) => {
            return getFightResponseExpiresAt({ data, fightId, now });
          },
          key: makeFellowshipLogsResponseKey("FIGHT", [reportCode, fightId]),
          operation: "FIGHT",
          reportCode,
          schema: FellowshipLogsFightResponseDataSchema,
        },
        trackedQuery(
          {
            query: GET_FIGHT_QUERY,
            variables: {
              fightId,
              reportCode,
            },
          },
          FellowshipLogsFightResponseDataSchema,
        ),
      );

      const report = yield* getReportOrFail({
        report: responseData.reportData.report,
        reportCode,
      });

      return yield* findFightOrFail({
        fightId,
        fights: report.fights,
        reportCode,
      });
    });

    const getReportPage = E.fn("FellowshipLogs.getReportPage")(function* ({
      endTime,
      fightId,
      isCacheable,
      reportCode,
      startTime,
    }: GetReportPageOptions) {
      const fetchReportPage = trackedQuery(
        {
          query: makeQuery({
            name: "GetDungeonRunReport",
            selections: [REPORT_SELECTION, RATE_LIMIT_DATA_SELECTION],
            variables: REPORT_VARIABLES,
          }),
          variables: {
            endTime,
            reportCode,
            startTime,
          },
        },
        FellowshipLogsReportResponseDataSchema,
      );

      const responseData = isCacheable
        ? yield* responseCache.cached(
            {
              fightId,
              getExpiresAt: getReportPageResponseExpiresAt,
              getReportRevision: (data) => {
                return data.reportData.report?.revision ?? null;
              },
              key: makeFellowshipLogsResponseKey("REPORT_PAGE", [
                reportCode,
                startTime,
                endTime,
              ]),
              operation: "REPORT_PAGE",
              reportCode,
              schema: FellowshipLogsReportResponseDataSchema,
            },
            fetchReportPage,
          )
        : yield* fetchReportPage;

      const report = yield* getReportOrFail({
        report: responseData.reportData.report,
        reportCode,
      });

      yield* E.logDebug("Fetched Fellowship Logs report page.", {
        endTime,
        eventCount: report.events.data.length,
        nextPageTimestamp: report.events.nextPageTimestamp,
        reportCode,
        startTime,
      });

      return report;
    });

    const streamReportPages: FellowshipLogsService["streamReportPages"] = ({
      fightId,
      onProgress,
      reportCode,
    }) => {
      return Stream.unwrap(
        E.gen(function* () {
          const fight = yield* getFight({
            fightId,
            reportCode,
          });

          const firstRevisionRef = yield* Ref.make(Option.none<number>());

          const checkRevision = (revision: number) => {
            if (!fight.inProgress) {
              return E.void;
            }

            return Ref.modify(firstRevisionRef, (firstRevision) => {
              return Option.match(firstRevision, {
                onNone: () => [true, Option.some(revision)] as const,
                onSome: (first) => [first === revision, firstRevision] as const,
              });
            }).pipe(
              E.flatMap((isUnchanged) => {
                return isUnchanged
                  ? E.void
                  : E.fail(
                      new FellowshipLogsReportChangedError({
                        fightId,
                        reportCode,
                      }),
                    );
              }),
            );
          };

          return Stream.paginate(fight.startTime, (startTime) => {
            return getReportPage({
              endTime: fight.endTime,
              fightId,
              isCacheable: !fight.inProgress,
              reportCode,
              startTime,
            }).pipe(
              E.tap((reportPage) => {
                return checkRevision(reportPage.revision);
              }),
              E.tap((reportPage) => {
                return onProgress === undefined
                  ? E.void
                  : onProgress(
                      getReportPageProgress({
                        endTime: fight.endTime,
                        nextPageTimestamp: reportPage.events.nextPageTimestamp,
                        startTime: fight.startTime,
                      }),
                    );
              }),
              E.map((reportPage) => {
                return [
                  [reportPage],
                  Option.fromNullishOr(reportPage.events.nextPageTimestamp),
                ] as const;
              }),
            );
          });
        }),
      );
    };

    const getReport: FellowshipLogsService["getReport"] = (options) => {
      return E.gen(function* () {
        const reportPages = yield* Stream.runCollect(
          streamReportPages(options),
        );

        const firstReportPage = reportPages[0];

        if (firstReportPage === undefined) {
          return yield* new FellowshipLogsGraphQLResponseError({
            errors: [],
            reason: "MissingReportPages",
          });
        }

        const events = reportPages.flatMap((reportPage) => {
          return reportPage.events.data;
        });

        return {
          ...firstReportPage,
          events: {
            data: events,
            nextPageTimestamp: null,
          },
        };
      });
    };

    const streamEvents: FellowshipLogsService["streamEvents"] = (options) => {
      return streamFellowshipLogsEvents(streamReportPages(options));
    };

    return {
      getDungeonRunMetadata,
      getRateLimitData,
      getReport,
      streamEvents,
      streamReportPages,
    } satisfies FellowshipLogsService;
  });
}

function makeFellowshipLogsService(getCredentials: GetCredentials) {
  return E.gen(function* () {
    const query = yield* makeFellowshipLogsHttpQuery(getCredentials);

    return yield* makeFellowshipLogsServiceFromQuery(query);
  });
}

export const makeFellowshipLogs = E.gen(function* () {
  const appSettings = yield* AppSettings;

  const getCredentials = E.fn("FellowshipLogs.getCredentials")(function* () {
    const settings = yield* appSettings.get();

    if (
      settings.fellowshipLogsClientId === null ||
      settings.fellowshipLogsClientSecret === null
    ) {
      return yield* new FellowshipLogsRequestError({
        cause: new Error("Fellowship Logs credentials are not configured."),
        operation: "GetAccessToken",
      });
    }

    return {
      clientId: settings.fellowshipLogsClientId,
      clientSecret: Redacted.value(settings.fellowshipLogsClientSecret),
    } satisfies FellowshipLogsCredentials;
  });

  return yield* makeFellowshipLogsService(getCredentials);
});
