import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { FellowshipLogsGatewayReportChangedError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  getFightResponseExpiresAt,
  getReportPageResponseExpiresAt,
  makeFellowshipLogsGatewayResponseKey,
} from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-cache-policy.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { makeConnectionGatewayAccessSource } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import {
  addFellowshipLogsGatewayWorkflowCost,
  withFellowshipLogsGatewayWorkflowCost,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import {
  deriveDungeonRunMetadata,
  findFightOrFail,
  type GetFellowshipLogsGatewayRequestContext,
  getReportOrFail,
  getReportPageProgress,
  makeFellowshipLogsGatewayRateLimitDataTracker,
  makeTrackedQuery,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts";
import { type FellowshipLogsGatewayShape } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { normalizeFellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/normalize-fellowship-logs-gateway-report.ts";
import { DUNGEON_RUN_METADATA_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { GET_FIGHT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-fight-query.ts";
import { RATE_LIMIT_DATA_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import { REPORT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import { type Query } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
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

export const makeFellowshipLogsGatewayFromQuery = E.fnUntraced(function* (
  query: Query,
  getRequestContext: GetFellowshipLogsGatewayRequestContext = () =>
    E.succeed(DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT),
) {
  const responseCache = yield* FellowshipLogsGatewayResponseCache;
  const rateLimitTracker = yield* makeFellowshipLogsGatewayRateLimitDataTracker;
  const trackedQuery = makeTrackedQuery(
    query,
    rateLimitTracker,
    getRequestContext,
  );

  const lookUpDungeonRunMetadata = E.fn(
    "FellowshipLogsGateway.lookUpDungeonRunMetadata",
  )(function* ({
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
          query: DUNGEON_RUN_METADATA_QUERY,
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

  const getRateLimitData: FellowshipLogsGatewayShape["getRateLimitData"] = E.fn(
    "FellowshipLogsGateway.getRateLimitData",
  )(function* (options) {
    if (options?.force === true) {
      yield* trackedQuery(
        {
          query: RATE_LIMIT_DATA_QUERY,
        },
        FellowshipLogsRateLimitResponseDataSchema,
        { operation: "RATE_LIMIT_DATA", skipCapacityCheck: true },
      );
    }

    const { connectionIdentity } = yield* getRequestContext();

    return yield* rateLimitTracker.getLastKnown(connectionIdentity);
  });

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

  const getReportPage = E.fn("FellowshipLogsGateway.getReportPage")(function* ({
    endTime,
    fightId,
    isCacheable,
    reportCode,
    startTime,
  }: GetReportPageOptions) {
    const fetchReportPage = trackedQuery(
      {
        query: REPORT_QUERY,
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

    const rawReport = yield* getReportOrFail({
      report: responseData.reportData.report,
      reportCode,
    });
    const report = yield* normalizeFellowshipLogsGatewayReport(rawReport);

    const pageAttributes = {
      "fellowship_logs.event_count": report.events.data.length,
      "fellowship_logs.next_page_timestamp": report.events.nextPageTimestamp,
      "fellowship_logs.page_end_time": endTime,
      "fellowship_logs.page_start_time": startTime,
      "fellowship_logs.report_code": reportCode,
    };

    yield* E.annotateCurrentSpan(pageAttributes);

    yield* E.logDebug("Fetched Fellowship Logs report page.", pageAttributes);

    return report;
  });

  const streamReportPages: FellowshipLogsGatewayShape["streamReportPages"] = ({
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

  const getDungeonRunMetadata: FellowshipLogsGatewayShape["getDungeonRunMetadata"] =
    (options) => {
      return withFellowshipLogsGatewayWorkflowCost(
        lookUpDungeonRunMetadata(options),
      ).pipe(
        E.tap(([, cost]) => {
          return addFellowshipLogsGatewayWorkflowCost(cost);
        }),
        E.map(([metadata, workflowCost]) => {
          return { ...metadata, workflowCost };
        }),
      );
    };

  return {
    getDungeonRunMetadata,
    getRateLimitData,
    streamReportPages,
  } satisfies FellowshipLogsGatewayShape;
});

export const makeFellowshipLogsGateway = E.gen(function* () {
  const accessSource = yield* makeConnectionGatewayAccessSource({
    refuseWithoutPointSystemOptIn: true,
  });
  const query = yield* makeFellowshipLogsGatewayHttpQuery(accessSource);

  return yield* makeFellowshipLogsGatewayFromQuery(
    query,
    accessSource.getRequestContext,
  );
});
