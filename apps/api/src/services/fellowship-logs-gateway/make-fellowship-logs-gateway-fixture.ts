import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { streamFellowshipLogsGatewayEvents } from "@frt/api/services/fellowship-logs-gateway/events/stream-fellowship-logs-gateway-events.ts";
import { getFellowshipLogsReportFixtureDirectory } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-fixture-paths.ts";
import {
  type FellowshipLogsGatewayDungeonRunMetadata,
  type FellowshipLogsGatewayShape,
  type GetFellowshipLogsGatewayReportOptions,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  deriveDungeonRunMetadata,
  getReportOrFail,
  makeFellowshipLogsRateLimitDataTracker,
  readAndTrackGraphQLResponse,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-response-helpers.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { makeFellowshipLogsGatewayGraphQLResponseSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { PositiveIntegerFromStringSchema } from "@frt/shared/util/common-schemas.ts";

type MakeFellowshipLogsFixtureLiveOptions = {
  readonly fixtureDirectory: string;
};

const FellowshipLogsMetadataResponseJsonSchema =
  FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema.pipe(
    makeFellowshipLogsGatewayGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const FellowshipLogsReportPageResponseJsonSchema =
  FellowshipLogsGatewayReportResponseDataSchema.pipe(
    makeFellowshipLogsGatewayGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const FellowshipLogsRateLimitResponseJsonSchema =
  FellowshipLogsRateLimitResponseDataSchema.pipe(
    makeFellowshipLogsGatewayGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const PageFilenameSchema = Schema.TemplateLiteralParser([
  "page-",
  PositiveIntegerFromStringSchema,
  ".json",
]);

const getPageNumber = E.fn("FellowshipLogsFixture.getPageNumber")(function* (
  filename: string,
) {
  const parsed = yield* Schema.decodeUnknownEffect(PageFilenameSchema)(
    filename,
  ).pipe(E.option);

  return Option.map(parsed, ([, pageNumber]) => {
    return pageNumber;
  });
});

type PagePathEntry = {
  readonly filePath: string;
  readonly pageNumber: number;
};

function mapFixtureError(cause: unknown) {
  return new FellowshipLogsGatewayRequestError({
    cause,
    operation: "ReadFixture",
  });
}

export function makeFellowshipLogsGatewayFixture({
  fixtureDirectory,
}: MakeFellowshipLogsFixtureLiveOptions) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const rateLimitTracker = yield* makeFellowshipLogsRateLimitDataTracker();

    function getReportFixtureDirectory(
      options: GetFellowshipLogsGatewayReportOptions,
    ) {
      return getFellowshipLogsReportFixtureDirectory({
        fixtureDirectory,
        options,
        path,
      });
    }

    const readReportPageResponse = (filePath: string) => {
      return E.gen(function* () {
        const contents = yield* fileSystem.readFileString(filePath);

        return yield* Schema.decodeEffect(
          FellowshipLogsReportPageResponseJsonSchema,
        )(contents);
      }).pipe(E.mapError(mapFixtureError));
    };

    const fetchReportPage = E.fn("FellowshipLogsFixture.fetchReportPage")(
      function* (
        response: typeof FellowshipLogsReportPageResponseJsonSchema.Type,
        reportCode: FellowshipLogsReportCode,
      ) {
        const responseData = yield* E.succeed(response).pipe(
          readAndTrackGraphQLResponse(rateLimitTracker, {
            costKey: "ReportPage",
          }),
        );

        return yield* getReportOrFail({
          report: responseData.reportData.report,
          reportCode,
        });
      },
    );

    const getReportPagePaths = E.fn("FellowshipLogsFixture.getReportPagePaths")(
      function* (options: GetFellowshipLogsGatewayReportOptions) {
        return yield* E.gen(function* () {
          const reportFixtureDirectory = getReportFixtureDirectory(options);

          const filenames = yield* fileSystem.readDirectory(
            reportFixtureDirectory,
          );

          const pagePathOptions = yield* E.forEach(filenames, (filename) => {
            return getPageNumber(filename).pipe(
              E.map(
                Option.map((pageNumber): PagePathEntry => {
                  return {
                    filePath: path.join(reportFixtureDirectory, filename),
                    pageNumber,
                  };
                }),
              ),
            );
          });

          return pipe(
            pagePathOptions,
            A.flatMap(Option.toArray),
            A.sort(
              Order.mapInput(Order.Number, (pagePath: PagePathEntry) => {
                return pagePath.pageNumber;
              }),
            ),
          );
        }).pipe(E.mapError(mapFixtureError));
      },
    );

    const getDungeonRunMetadata: FellowshipLogsGatewayShape["getDungeonRunMetadata"] =
      E.fn("FellowshipLogsFixture.getDungeonRunMetadata")(function* (options) {
        const metadataPath = path.join(
          getReportFixtureDirectory(options),
          "metadata.json",
        );

        const responseData = yield* E.gen(function* () {
          const contents = yield* fileSystem.readFileString(metadataPath);

          return yield* Schema.decodeEffect(
            FellowshipLogsMetadataResponseJsonSchema,
          )(contents);
        }).pipe(
          E.mapError(mapFixtureError),
          readAndTrackGraphQLResponse(rateLimitTracker, {
            costKey: "DungeonRunMetadata",
          }),
        );

        const metadata = yield* deriveDungeonRunMetadata({
          fightId: options.fightId,
          reportCode: options.reportCode,
          responseData,
        });

        return {
          dungeonId: metadata.dungeonId,
          dungeonLevel: metadata.dungeonLevel,
          endedAt: DateTime.makeUnsafe(metadata.endedAtMilliseconds),
          isInProgress: metadata.isInProgress,
          startedAt: DateTime.makeUnsafe(metadata.startedAtMilliseconds),
        } satisfies FellowshipLogsGatewayDungeonRunMetadata;
      });

    const streamReportPages: FellowshipLogsGatewayShape["streamReportPages"] = (
      options,
    ) => {
      return Stream.unwrap(
        getReportPagePaths(options).pipe(
          E.map((pagePaths) => {
            const responses = Stream.fromIterable(pagePaths.entries()).pipe(
              Stream.mapEffect(([index, { filePath }]) => {
                return readReportPageResponse(filePath).pipe(
                  E.map((response) => {
                    return { index, response };
                  }),
                );
              }),
            );

            return responses.pipe(
              Stream.mapEffect(({ index, response }) => {
                return fetchReportPage(response, options.reportCode).pipe(
                  E.tap(() => {
                    return options.onProgress === undefined
                      ? E.void
                      : options.onProgress((index + 1) / pagePaths.length);
                  }),
                );
              }),
            );
          }),
        ),
      );
    };

    const getReport: FellowshipLogsGatewayShape["getReport"] = (options) => {
      return E.gen(function* () {
        const reportPages = yield* Stream.runCollect(
          streamReportPages(options),
        );

        const firstReportPage = reportPages[0];

        if (firstReportPage === undefined) {
          return yield* new FellowshipLogsGatewayRequestError({
            cause: new Error(
              "Fellowship Logs fixture contains no report pages.",
            ),
            operation: "ReadFixture",
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

    const getRateLimitData: FellowshipLogsGatewayShape["getRateLimitData"] = (
      options,
    ) => {
      if (options?.force !== true) {
        return rateLimitTracker.getLastKnown();
      }

      return E.gen(function* () {
        const fixturePath = path.resolve(
          fixtureDirectory,
          "rate-limit-data.json",
        );

        const contents = yield* fileSystem.readFileString(fixturePath);

        return yield* Schema.decodeEffect(
          FellowshipLogsRateLimitResponseJsonSchema,
        )(contents);
      }).pipe(
        E.mapError(mapFixtureError),
        readAndTrackGraphQLResponse(rateLimitTracker, {
          costKey: "RateLimitData",
          skipCapacityCheck: true,
        }),
        E.andThen(rateLimitTracker.getLastKnown()),
      );
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
