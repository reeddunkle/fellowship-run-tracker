import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsGatewayRateLimitExceededError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import {
  FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
  getFellowshipLogsReportFixtureDirectory,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-fixture-paths.ts";
import {
  FellowshipLogsGateway,
  type FellowshipLogsGatewayShape,
  type Query,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { makeFellowshipLogsGatewayFromQuery } from "@frt/api/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { makeFellowshipLogsGatewayGraphQLResponseSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export const RECORDED_FIGHT = {
  fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
  reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
    "XdfFZzgHBJNr6m3v",
  ),
};

export const RECORDED_FIGHT_PAGE_COUNT = 13;

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

const MetadataResponseJsonSchema =
  FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema.pipe(
    makeFellowshipLogsGatewayGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const ReportPageResponseJsonSchema =
  FellowshipLogsGatewayReportResponseDataSchema.pipe(
    makeFellowshipLogsGatewayGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const RequestVariablesSchema = Schema.Struct({
  startTime: Schema.optional(Schema.Number),
});

function getQueryName(query: string) {
  return /query\s+(\w+)/.exec(query)?.[1] ?? "RateLimitData";
}

const makeRecordedFightQuery = E.fn("test.makeRecordedFightQuery")(function* (
  control: FellowshipLogsFetchControl,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const directory = getFellowshipLogsReportFixtureDirectory({
    fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    options: RECORDED_FIGHT,
    path,
  });

  const readFixture = (filename: string) => {
    return fileSystem
      .readFileString(path.join(directory, filename))
      .pipe(E.orDie);
  };

  const metadata = yield* readFixture("metadata.json").pipe(
    E.flatMap(Schema.decodeEffect(MetadataResponseJsonSchema)),
    E.orDie,
  );

  const pages = yield* E.forEach(
    Array.from({ length: RECORDED_FIGHT_PAGE_COUNT }, (_, index) => index + 1),
    (pageNumber) => {
      return readFixture(`page-${pageNumber}.json`).pipe(
        E.flatMap(Schema.decodeEffect(ReportPageResponseJsonSchema)),
        E.orDie,
      );
    },
  );

  const report = metadata.data?.reportData.report;
  const fight = report?.fights[0];

  if (report === undefined || report === null || fight === undefined) {
    return yield* E.die(new Error("The recorded fight has no metadata."));
  }

  const pagesByStartTime = new Map(
    pages.map((page, index) => {
      const previous = pages[index - 1];
      const startTime =
        previous === undefined
          ? fight.startTime
          : previous.data?.reportData.report?.events.nextPageTimestamp;

      return [startTime, page] as const;
    }),
  );

  const getBody = (queryName: string, variables: unknown) => {
    const withFight = {
      ...fight,
      inProgress: control.isInProgress,
    };

    switch (queryName) {
      case "GetDungeonRunMetadata": {
        return E.succeed({
          ...metadata,
          data: {
            ...metadata.data,
            reportData: { report: { ...report, fights: [withFight] } },
          },
        });
      }
      case "GetFight": {
        return E.succeed({
          ...metadata,
          data: {
            ...metadata.data,
            reportData: {
              report: { endTime: report.endTime, fights: [withFight] },
            },
          },
        });
      }
      case "GetDungeonRunReport": {
        return Schema.decodeUnknownEffect(RequestVariablesSchema)(
          variables,
        ).pipe(
          E.orDie,
          E.flatMap(({ startTime }) => {
            const page = pagesByStartTime.get(startTime);
            const pageReport = page?.data?.reportData.report;

            if (page === undefined || pageReport === undefined) {
              return E.die(new Error(`No recorded page at ${startTime}.`));
            }

            control.pagesFetched += 1;

            return E.succeed(
              control.overrideRevision === undefined || pageReport === null
                ? page
                : {
                    ...page,
                    data: {
                      ...page.data,
                      reportData: {
                        report: {
                          ...pageReport,
                          revision: control.overrideRevision,
                        },
                      },
                    },
                  },
            );
          }),
        );
      }
      default: {
        return E.succeed({
          data: { rateLimitData: metadata.data?.rateLimitData },
        });
      }
    }
  };

  const query: Query = (request, responseSchema) => {
    return E.gen(function* () {
      const queryName = getQueryName(request.query);

      control.requests.push(queryName);

      const body = yield* getBody(queryName, request.variables);

      return yield* Schema.decodeUnknownEffect(
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
  };

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
    Layer.provide(FellowshipLogsGatewayResponseCache.layer),
    Layer.provide(NodePlatformLayer),
  );
}
