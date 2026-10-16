import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsGatewayRateLimitExceededError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { makeFellowshipLogsGatewayFileQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-file-query.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts";
import {
  FellowshipLogsGateway,
  type FellowshipLogsGatewayShape,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { makeFellowshipLogsGatewayFromQuery } from "@frt/api/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts";
import { normalizeFellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/normalize-fellowship-logs-gateway-report.ts";
import { GET_FIGHT_QUERY } from "@frt/api/services/fellowship-logs-gateway/query/get-fight-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { RATE_LIMIT_DATA_SELECTION } from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { FellowshipLogsGatewayFightResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-fight-schema.ts";
import {
  type FellowshipLogsGatewayGraphQLRequest,
  makeFellowshipLogsGatewayGraphQLResponseSchema,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export const RECORDED_FIGHT = {
  fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
  reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
    "XdfFZzgHBJNr6m3v",
  ),
};

export const CONTROLLED_PAGE_COUNT = 13;

export type FellowshipLogsFetchControl = {
  failAfterPages: number | undefined;
  failureResetDelayMilliseconds: number;
  isInProgress: boolean;
  overrideRevision: number | undefined;
  pagesFetched: number;
  requests: Array<string>;
};

export function makeFellowshipLogsFetchControl(): FellowshipLogsFetchControl {
  return {
    failAfterPages: undefined,
    failureResetDelayMilliseconds: 0,
    isInProgress: false,
    overrideRevision: undefined,
    pagesFetched: 0,
    requests: [],
  };
}

const RECORDED_REPORT_PAGE_QUERY = makeQuery({
  name: "GetDungeonRunReport",
  selections: [REPORT_SELECTION, RATE_LIMIT_DATA_SELECTION],
  variables: REPORT_VARIABLES,
});

const EventTimestampSchema = Schema.Struct({
  timestamp: Schema.Finite,
});

const ReportPageRequestVariablesSchema = Schema.Struct({
  startTime: Schema.Finite,
});

function getQueryName(query: string) {
  return /query\s+(\w+)/.exec(query)?.[1] ?? "RateLimitData";
}

const makeRecordedFightQuery = E.fnUntraced(function* (
  control: FellowshipLogsFetchControl,
) {
  const fileQuery = yield* makeFellowshipLogsGatewayFileQuery({
    fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
  });

  const readFightBody = (request: FellowshipLogsGatewayGraphQLRequest) => {
    return fileQuery(
      request,
      FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema,
    ).pipe(
      E.map((response) => {
        const report = response.data?.reportData.report;

        if (report === undefined || report === null) {
          return response;
        }

        return {
          ...response,
          data: {
            ...response.data,
            reportData: {
              report: {
                ...report,
                fights: report.fights.map((fight) => {
                  return { ...fight, inProgress: control.isInProgress };
                }),
              },
            },
          },
        };
      }),
    );
  };

  const readRecordedReportPage = E.fnUntraced(function* (startTime: number) {
    const response = yield* fileQuery(
      {
        query: RECORDED_REPORT_PAGE_QUERY,
        variables: { reportCode: RECORDED_FIGHT.reportCode, startTime },
      },
      FellowshipLogsGatewayReportResponseDataSchema,
    );
    const report = response.data?.reportData.report;

    if (report === undefined || report === null) {
      return yield* E.die(new Error("A recorded page has no report data."));
    }

    const normalizedReport =
      yield* normalizeFellowshipLogsGatewayReport(report);

    return { report: normalizedReport, response };
  });

  const readRecordedReportPages = E.fnUntraced(function* () {
    const fightResponse = yield* fileQuery(
      { query: GET_FIGHT_QUERY, variables: RECORDED_FIGHT },
      FellowshipLogsGatewayFightResponseDataSchema,
    );
    const fight = fightResponse.data?.reportData.report?.fights[0];

    if (fight === undefined) {
      return yield* E.die(new Error("The recorded fight has no metadata."));
    }

    const pages = yield* Stream.paginate(fight.startTime, (startTime) => {
      return readRecordedReportPage(startTime).pipe(
        E.map((page) => {
          return [
            [page],
            Option.fromNullishOr(page.report.events.nextPageTimestamp),
          ] as const;
        }),
      );
    }).pipe(Stream.runCollect);

    return { fight, pages };
  });

  const splitRecordedReportPages = E.fnUntraced(function* () {
    const { fight, pages } = yield* readRecordedReportPages();
    const firstPage = pages[0];

    if (firstPage === undefined) {
      return yield* E.die(new Error("The recorded fight has no pages."));
    }

    const events = pages.flatMap(({ report }) => {
      return report.events.data;
    });

    const chunks = A.makeBy(CONTROLLED_PAGE_COUNT, (index) => {
      return events.slice(
        Math.floor((index * events.length) / CONTROLLED_PAGE_COUNT),
        Math.floor(((index + 1) * events.length) / CONTROLLED_PAGE_COUNT),
      );
    });

    const nextPageTimestamps = yield* E.forEach(chunks.slice(1), (chunk) => {
      return Schema.decodeUnknownEffect(EventTimestampSchema)(chunk[0]).pipe(
        E.map(({ timestamp }) => {
          return timestamp;
        }),
        E.orDie,
      );
    });

    const startTimes = [fight.startTime, ...nextPageTimestamps];

    if (new Set(startTimes).size !== startTimes.length) {
      return yield* E.die(new Error("Two split pages share a start time."));
    }

    const { code, endTime, masterData, revision, startTime, title } =
      firstPage.report;

    const splitPages = A.zip(chunks, [...nextPageTimestamps, null]).map(
      ([data, nextPageTimestamp]) => {
        return {
          ...firstPage.response,
          data: {
            ...firstPage.response.data,
            reportData: {
              report: {
                code,
                endTime,
                events: { data, nextPageTimestamp },
                masterData,
                revision,
                startTime,
                title,
              },
            },
          },
        };
      },
    );

    return new Map(A.zip(startTimes, splitPages));
  });

  const getSplitReportPages = yield* E.cached(splitRecordedReportPages());

  const readReportPageBody = E.fnUntraced(function* (
    request: FellowshipLogsGatewayGraphQLRequest,
  ) {
    const { startTime } = yield* Schema.decodeUnknownEffect(
      ReportPageRequestVariablesSchema,
    )(request.variables).pipe(E.orDie);

    const splitReportPages = yield* getSplitReportPages;
    const page = splitReportPages.get(startTime);

    if (page === undefined) {
      return yield* E.die(new Error(`No split page at ${startTime}.`));
    }

    control.pagesFetched += 1;

    if (control.overrideRevision === undefined) {
      return page;
    }

    return {
      ...page,
      data: {
        ...page.data,
        reportData: {
          report: {
            ...page.data.reportData.report,
            revision: control.overrideRevision,
          },
        },
      },
    };
  });

  const readBody = (
    queryName: string,
    request: FellowshipLogsGatewayGraphQLRequest,
  ) => {
    if (queryName === "GetFight" || queryName === "GetDungeonRunMetadata") {
      return readFightBody(request);
    }

    if (queryName === "GetDungeonRunReport") {
      return readReportPageBody(request);
    }

    return fileQuery(request, Schema.Unknown);
  };

  const query: Query = E.fnUntraced(function* (request, responseSchema) {
    const queryName = getQueryName(request.query);

    control.requests.push(queryName);

    const body = yield* readBody(queryName, request);

    return yield* Schema.decodeEffect(
      makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
    )(body).pipe(
      E.mapError((cause) => {
        return new FellowshipLogsGatewayRequestError({
          cause,
          operation: "Query",
        });
      }),
    );
  });

  return query;
});

export function makeControlledFellowshipLogsFixtureLayer(
  control: FellowshipLogsFetchControl,
) {
  return Layer.effect(
    FellowshipLogsGateway,
    E.gen(function* () {
      const query = yield* makeRecordedFightQuery(control);
      const fellowshipLogsGateway =
        yield* makeFellowshipLogsGatewayFromQuery(query);

      const runOutOfPoints = DateTime.now.pipe(
        E.flatMap((now) => {
          return E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
              reason: "RejectedByApi",
              resetsAt: DateTime.add(now, {
                milliseconds: control.failureResetDelayMilliseconds,
              }),
            }),
          );
        }),
      );

      const streamReportPages: FellowshipLogsGatewayShape["streamReportPages"] =
        (options) => {
          return fellowshipLogsGateway.streamReportPages(options).pipe(
            Stream.zipWithIndex,
            Stream.mapEffect(([page, index]) => {
              return control.failAfterPages !== undefined &&
                index >= control.failAfterPages
                ? runOutOfPoints
                : E.succeed(page);
            }),
          );
        };

      return {
        ...fellowshipLogsGateway,
        streamReportPages,
      } satisfies FellowshipLogsGatewayShape;
    }),
  ).pipe(
    Layer.provide(FellowshipLogsAnalytics.layer),
    Layer.provide(FellowshipLogsGatewayResponseCache.layer),
    Layer.provide(NodePlatformLayer),
  );
}
