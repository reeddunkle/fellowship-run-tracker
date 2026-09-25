import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsGatewayGraphQLResponseError,
  FellowshipLogsGatewayReportChangedError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import {
  getFightResponseExpiresAt,
  getReportPageResponseExpiresAt,
  makeFellowshipLogsGatewayResponseKey,
} from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-cache-policy.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { streamFellowshipLogsGatewayEvents } from "@frt/api/services/fellowship-logs-gateway/events/stream-fellowship-logs-gateway-events.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import {
  deriveDungeonRunMetadata,
  findFightOrFail,
  getReportOrFail,
  getReportPageProgress,
  makeFellowshipLogsGatewayRateLimitDataTracker,
  makeTrackedQuery,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts";
import {
  type FellowshipLogsGatewayCredentials,
  type FellowshipLogsGatewayShape,
  type GetCredentials,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { GET_FIGHT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-fight-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "./validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { FellowshipLogsGatewayFightResponseDataSchema } from "./validation/fellowship-logs-gateway-fight-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "./validation/fellowship-logs-gateway-report-schema.ts";

type GetReportPageOptions = {
  readonly endTime: number;
  readonly fightId: FellowshipLogsFightId;
  readonly isCacheable: boolean;
  readonly reportCode: FellowshipLogsReportCode;
  readonly startTime: number;
};

export function makeFellowshipLogsGatewayFromQuery(query: Query) {
  return E.gen(function* () {
    const responseCache = yield* FellowshipLogsGatewayResponseCache;
    const rateLimitTracker =
      yield* makeFellowshipLogsGatewayRateLimitDataTracker();
    const trackedQuery = makeTrackedQuery(query, rateLimitTracker);

    const getDungeonRunMetadata: FellowshipLogsGatewayShape["getDungeonRunMetadata"] =
      E.fn("FellowshipLogsGateway.getDungeonRunMetadata")(function* ({
        fightId,
        reportCode,
      }) {
        const responseData = yield* responseCache.cached(
          {
            fightId,
            getExpiresAt: (data, now) => {
              return getFightResponseExpiresAt({ data, fightId, now });
            },
            key: makeFellowshipLogsGatewayResponseKey("DUNGEON_RUN_METADATA", [
              reportCode,
              fightId,
            ]),
            operation: "DUNGEON_RUN_METADATA",
            reportCode,
            schema: FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema,
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
            FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema,
            { operation: "DUNGEON_RUN_METADATA" },
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

    const getRateLimitData: FellowshipLogsGatewayShape["getRateLimitData"] = (
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
        { operation: "RATE_LIMIT_DATA", skipCapacityCheck: true },
      ).pipe(E.andThen(rateLimitTracker.getLastKnown()));
    };

    const getFight = E.fn("FellowshipLogsGateway.getFight")(function* ({
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
          key: makeFellowshipLogsGatewayResponseKey("FIGHT", [
            reportCode,
            fightId,
          ]),
          operation: "FIGHT",
          reportCode,
          schema: FellowshipLogsGatewayFightResponseDataSchema,
        },
        trackedQuery(
          {
            query: GET_FIGHT_QUERY,
            variables: {
              fightId,
              reportCode,
            },
          },
          FellowshipLogsGatewayFightResponseDataSchema,
          { operation: "FIGHT" },
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

    const getReportPage = E.fn("FellowshipLogsGateway.getReportPage")(
      function* ({
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
          FellowshipLogsGatewayReportResponseDataSchema,
          { operation: "REPORT_PAGE" },
        );

        const responseData = isCacheable
          ? yield* responseCache.cached(
              {
                fightId,
                getExpiresAt: getReportPageResponseExpiresAt,
                getReportRevision: (data) => {
                  return data.reportData.report?.revision ?? null;
                },
                key: makeFellowshipLogsGatewayResponseKey("REPORT_PAGE", [
                  reportCode,
                  startTime,
                  endTime,
                ]),
                operation: "REPORT_PAGE",
                reportCode,
                schema: FellowshipLogsGatewayReportResponseDataSchema,
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
      },
    );

    const streamReportPages: FellowshipLogsGatewayShape["streamReportPages"] =
      ({ fightId, onProgress, reportCode }) => {
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
                  onSome: (first) =>
                    [first === revision, firstRevision] as const,
                });
              }).pipe(
                E.flatMap((isUnchanged) => {
                  return isUnchanged
                    ? E.void
                    : E.fail(
                        new FellowshipLogsGatewayReportChangedError({
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
                          nextPageTimestamp:
                            reportPage.events.nextPageTimestamp,
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

    const getReport: FellowshipLogsGatewayShape["getReport"] = (options) => {
      return E.gen(function* () {
        const reportPages = yield* Stream.runCollect(
          streamReportPages(options),
        );

        const firstReportPage = reportPages[0];

        if (firstReportPage === undefined) {
          return yield* new FellowshipLogsGatewayGraphQLResponseError({
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

    const streamEvents: FellowshipLogsGatewayShape["streamEvents"] = (
      options,
    ) => {
      return streamFellowshipLogsGatewayEvents(streamReportPages(options));
    };

    return {
      getDungeonRunMetadata,
      getRateLimitData,
      getReport,
      streamEvents,
      streamReportPages,
    } satisfies FellowshipLogsGatewayShape;
  });
}

function makeFellowshipLogsGatewayFromCredentials(
  getCredentials: GetCredentials,
) {
  return E.gen(function* () {
    const query = yield* makeFellowshipLogsGatewayHttpQuery(getCredentials);

    return yield* makeFellowshipLogsGatewayFromQuery(query);
  });
}

export const makeFellowshipLogsGateway = E.gen(function* () {
  const appSettingsStore = yield* AppSettingsStore;

  const getCredentials = E.fn("FellowshipLogsGateway.getCredentials")(
    function* () {
      const settings = yield* appSettingsStore.get();

      if (
        settings.fellowshipLogsClientId === null ||
        settings.fellowshipLogsClientSecret === null
      ) {
        return yield* new FellowshipLogsGatewayRequestError({
          cause: new Error("Fellowship Logs credentials are not configured."),
          operation: "GetAccessToken",
        });
      }

      return {
        clientId: settings.fellowshipLogsClientId,
        clientSecret: Redacted.value(settings.fellowshipLogsClientSecret),
      } satisfies FellowshipLogsGatewayCredentials;
    },
  );

  return yield* makeFellowshipLogsGatewayFromCredentials(getCredentials);
});
