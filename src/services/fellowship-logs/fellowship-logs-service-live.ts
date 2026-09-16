import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsGraphQLResponseError,
  FellowshipLogsRequestError,
} from "@/errors/fellowship-logs-error.ts";
import { AppSettings } from "@/services/app-settings/app-settings-service.ts";
import { streamFellowshipLogsEvents } from "@/services/fellowship-logs/events/stream-fellowship-logs-events.ts";
import { makeFellowshipLogsHttpQuery } from "@/services/fellowship-logs/fellowship-logs-http-query.ts";
import {
  deriveDungeonRunMetadata,
  findFightOrFail,
  getGraphQLResponseData,
  getReportOrFail,
  makeFellowshipLogsRateLimitDataTracker,
  makeTrackedQuery,
} from "@/services/fellowship-logs/fellowship-logs-response-helpers.ts";
import {
  FellowshipLogs,
  type FellowshipLogsCredentials,
  type FellowshipLogsService,
  type GetCredentials,
  type Query,
} from "@/services/fellowship-logs/fellowship-logs-service.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@/services/fellowship-logs/query/get-dungeon-run-metadata-query.ts";
import { GET_FIGHT_QUERY } from "@/services/fellowship-logs/query/get-fight-query.ts";
import { makeQuery } from "@/services/fellowship-logs/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@/services/fellowship-logs/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@/services/fellowship-logs/query/report-query.ts";
import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { FellowshipLogsDungeonRunMetadataResponseDataSchema } from "./validation/fellowship-logs-dungeon-run-metadata-schema.ts";
import { FellowshipLogsFightResponseDataSchema } from "./validation/fellowship-logs-fight-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "./validation/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportResponseDataSchema } from "./validation/fellowship-logs-report-schema.ts";

type GetReportPageOptions = {
  readonly endTime: number;
  readonly reportCode: FellowshipLogsReportCode;
  readonly startTime: number;
};

function makeFellowshipLogsServiceFromQuery(query: Query) {
  return E.gen(function* () {
    const rateLimitTracker = yield* makeFellowshipLogsRateLimitDataTracker();
    const trackedQuery = makeTrackedQuery(query, rateLimitTracker);

    const getDungeonRunMetadata: FellowshipLogsService["getDungeonRunMetadata"] =
      E.fn("FellowshipLogs.getDungeonRunMetadata")(function* ({
        fightId,
        reportCode,
      }) {
        const responseData = yield* trackedQuery(
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
      ).pipe(
        E.map((responseData) => {
          return responseData.rateLimitData;
        }),
      );
    };

    // `getFight` is an internal detail used only to find pagination bounds
    // for `streamReportPages`; it isn't a public-facing method, so unlike
    // the others it doesn't piggyback a rate limit reading onto its query.
    const getFight = E.fn("FellowshipLogs.getFight")(function* ({
      fightId,
      reportCode,
    }: {
      readonly fightId: FellowshipLogsFightId;
      readonly reportCode: FellowshipLogsReportCode;
    }) {
      const response = yield* query(
        {
          query: GET_FIGHT_QUERY,
          variables: {
            fightId,
            reportCode,
          },
        },
        FellowshipLogsFightResponseDataSchema,
      );

      const responseData = yield* getGraphQLResponseData(response);

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
      reportCode,
      startTime,
    }: GetReportPageOptions) {
      const responseData = yield* trackedQuery(
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
      reportCode,
    }) => {
      return Stream.unwrap(
        E.gen(function* () {
          const fight = yield* getFight({
            fightId,
            reportCode,
          });

          return Stream.paginate(fight.startTime, (startTime) => {
            return getReportPage({
              endTime: fight.endTime,
              reportCode,
              startTime,
            }).pipe(
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
            message: "Fellowship Logs returned no report pages.",
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

const makeFellowshipLogsFromAppSettings = E.gen(function* () {
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

export const FellowshipLogsLive = Layer.effect(
  FellowshipLogs,
  makeFellowshipLogsFromAppSettings,
);
