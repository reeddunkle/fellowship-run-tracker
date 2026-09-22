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

import { FellowshipLogsRequestError } from "@frt/api/errors/fellowship-logs-error.ts";
import { streamFellowshipLogsEvents } from "@frt/api/services/fellowship-logs/events/stream-fellowship-logs-events.ts";
import { getFellowshipLogsReportFixtureDirectory } from "@frt/api/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import {
  deriveDungeonRunMetadata,
  getReportOrFail,
  makeFellowshipLogsRateLimitDataTracker,
  readAndTrackGraphQLResponse,
} from "@frt/api/services/fellowship-logs/fellowship-logs-response-helpers.ts";
import {
  type FellowshipLogsDungeonRunMetadata,
  type FellowshipLogsService,
  type GetFellowshipLogsReportOptions,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { FellowshipLogsDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs/validation/fellowship-logs-dungeon-run-metadata-schema.ts";
import { makeFellowshipLogsGraphQLResponseSchema } from "@frt/api/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";
import { FellowshipLogsReportResponseDataSchema } from "@frt/api/services/fellowship-logs/validation/fellowship-logs-report-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import { PositiveIntegerFromStringSchema } from "@frt/shared/validation/common-schemas.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

type MakeFellowshipLogsFixtureLiveOptions = {
  readonly fixtureDirectory: string;
};

const FellowshipLogsMetadataResponseJsonSchema =
  FellowshipLogsDungeonRunMetadataResponseDataSchema.pipe(
    makeFellowshipLogsGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const FellowshipLogsReportPageResponseJsonSchema =
  FellowshipLogsReportResponseDataSchema.pipe(
    makeFellowshipLogsGraphQLResponseSchema,
    Schema.fromJsonString,
  );

const FellowshipLogsRateLimitResponseJsonSchema =
  FellowshipLogsRateLimitResponseDataSchema.pipe(
    makeFellowshipLogsGraphQLResponseSchema,
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
  return new FellowshipLogsRequestError({
    cause,
    operation: "ReadFixture",
  });
}

export function makeFellowshipLogsFixture({
  fixtureDirectory,
}: MakeFellowshipLogsFixtureLiveOptions) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const rateLimitTracker = yield* makeFellowshipLogsRateLimitDataTracker();

    function getReportFixtureDirectory(
      options: GetFellowshipLogsReportOptions,
    ) {
      return getFellowshipLogsReportFixtureDirectory({
        fixtureDirectory,
        options,
        path,
      });
    }

    const readReportPage = E.fn("FellowshipLogsFixture.readReportPage")(
      function* (filePath: string, reportCode: FellowshipLogsReportCode) {
        const responseData = yield* E.gen(function* () {
          const contents = yield* fileSystem.readFileString(filePath);

          return yield* Schema.decodeEffect(
            FellowshipLogsReportPageResponseJsonSchema,
          )(contents);
        }).pipe(
          E.mapError(mapFixtureError),
          readAndTrackGraphQLResponse(rateLimitTracker),
        );

        return yield* getReportOrFail({
          report: responseData.reportData.report,
          reportCode,
        });
      },
    );

    const getReportPagePaths = E.fn("FellowshipLogsFixture.getReportPagePaths")(
      function* (options: GetFellowshipLogsReportOptions) {
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

    const getDungeonRunMetadata: FellowshipLogsService["getDungeonRunMetadata"] =
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
          readAndTrackGraphQLResponse(rateLimitTracker),
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
          startedAt: DateTime.makeUnsafe(metadata.startedAtMilliseconds),
        } satisfies FellowshipLogsDungeonRunMetadata;
      });

    const streamReportPages: FellowshipLogsService["streamReportPages"] = (
      options,
    ) => {
      return Stream.unwrap(
        getReportPagePaths(options).pipe(
          E.map((pagePaths) => {
            return Stream.fromIterable(pagePaths).pipe(
              Stream.mapEffect(({ filePath }) => {
                return readReportPage(filePath, options.reportCode);
              }),
            );
          }),
        ),
      );
    };

    const getReport: FellowshipLogsService["getReport"] = (options) => {
      return E.gen(function* () {
        const reportPages = yield* Stream.runCollect(
          streamReportPages(options),
        );

        const firstReportPage = reportPages[0];

        if (firstReportPage === undefined) {
          return yield* new FellowshipLogsRequestError({
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

    const streamEvents: FellowshipLogsService["streamEvents"] = (options) => {
      return streamFellowshipLogsEvents(streamReportPages(options));
    };

    const getRateLimitData: FellowshipLogsService["getRateLimitData"] = (
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
        readAndTrackGraphQLResponse(rateLimitTracker),
        E.map((responseData) => {
          return responseData.rateLimitData;
        }),
      );
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
