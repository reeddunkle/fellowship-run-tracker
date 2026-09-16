import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
  getFellowshipLogsReportFixtureDirectory,
} from "@/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import { makeFellowshipLogsHttpQuery } from "@/services/fellowship-logs/fellowship-logs-http-query.ts";
import {
  findFightOrFail,
  getGraphQLResponseData,
  getReportOrFail,
} from "@/services/fellowship-logs/fellowship-logs-response-helpers.ts";
import { type FellowshipLogsCredentials } from "@/services/fellowship-logs/fellowship-logs-service.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@/services/fellowship-logs/query/get-dungeon-run-metadata-query.ts";
import { makeQuery } from "@/services/fellowship-logs/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@/services/fellowship-logs/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@/services/fellowship-logs/query/report-query.ts";
import { FellowshipLogsDungeonRunMetadataResponseDataSchema } from "@/services/fellowship-logs/validation/fellowship-logs-dungeon-run-metadata-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@/services/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportResponseDataSchema } from "@/services/fellowship-logs/validation/fellowship-logs-report-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";
import { FellowshipLogsFightIdSchema } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export const CaptureFellowshipLogsReportCommandInputSchema = Schema.Struct({
  fightId: FellowshipLogsFightIdSchema,
  outputFilePath: Schema.optionalKey(NonEmptyStringSchema),
  reportCode: FellowshipLogsReportCodeSchema,
});

type CaptureFellowshipLogsReportCommandInput =
  typeof CaptureFellowshipLogsReportCommandInputSchema.Type;

export type RunCaptureFellowshipLogsReportCommandOptions =
  CaptureFellowshipLogsReportCommandInput & {
    readonly credentials: FellowshipLogsCredentials;
  };

function stringifyFixture(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export const runCaptureFellowshipLogsReportCommand = E.fn(
  "dev-cli.capture-fellowship-logs-report",
)(function* ({
  credentials,
  fightId,
  outputFilePath,
  reportCode,
}: RunCaptureFellowshipLogsReportCommandOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const query = yield* makeFellowshipLogsHttpQuery(() => {
    return E.succeed(credentials);
  });

  const defaultOutputDirectory = getFellowshipLogsReportFixtureDirectory({
    fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    options: {
      fightId,
      reportCode,
    },
    path,
  });

  const resolvedOutputDirectory = path.resolve(
    outputFilePath ?? defaultOutputDirectory,
  );

  const resolvedFixtureDirectory =
    outputFilePath === undefined
      ? path.resolve(FELLOWSHIP_LOGS_FIXTURE_DIRECTORY)
      : path.dirname(resolvedOutputDirectory);

  const exists = yield* fileSystem.exists(resolvedOutputDirectory);

  if (exists) {
    yield* fileSystem.remove(resolvedOutputDirectory, {
      recursive: true,
    });
  }

  yield* fileSystem.makeDirectory(resolvedOutputDirectory, {
    recursive: true,
  });

  // This response is the exact JSON body Fellowship Logs returns for the
  // dungeon run metadata query; it is written to disk verbatim so the
  // fixture service can decode and process it the same way the live
  // service does.
  const metadataResponse = yield* query(
    {
      query: makeQuery({
        name: "GetDungeonRunMetadata",
        selections: [DUNGEON_RUN_METADATA_SELECTION, RATE_LIMIT_DATA_SELECTION],
        variables: DUNGEON_RUN_METADATA_VARIABLES,
      }),
      variables: {
        fightId,
        reportCode,
      },
    },
    FellowshipLogsDungeonRunMetadataResponseDataSchema,
  );

  const metadataOutputPath = path.join(
    resolvedOutputDirectory,
    "metadata.json",
  );

  yield* fileSystem.writeFileString(
    metadataOutputPath,
    stringifyFixture(metadataResponse),
  );

  yield* E.logInfo("Captured Fellowship Logs dungeon run metadata fixture.", {
    fightId,
    outputFilePath: metadataOutputPath,
    reportCode,
  });

  const metadataResponseData = yield* getGraphQLResponseData(metadataResponse);

  const report = yield* getReportOrFail({
    report: metadataResponseData.reportData.report,
    reportCode,
  });

  const fight = yield* findFightOrFail({
    fightId,
    fights: report.fights,
    reportCode,
  });

  const rateLimitResponse = yield* query(
    {
      query: RATE_LIMIT_DATA_QUERY,
    },
    FellowshipLogsRateLimitResponseDataSchema,
  );

  const rateLimitOutputPath = path.join(
    resolvedFixtureDirectory,
    "rate-limit-data.json",
  );

  yield* fileSystem.writeFileString(
    rateLimitOutputPath,
    stringifyFixture(rateLimitResponse),
  );

  yield* E.logInfo("Captured Fellowship Logs rate limit fixture.", {
    outputFilePath: rateLimitOutputPath,
  });

  const reportPageStream = Stream.paginate(fight.startTime, (startTime) => {
    return E.gen(function* () {
      const pageResponse = yield* query(
        {
          query: makeQuery({
            name: "GetDungeonRunReport",
            selections: [REPORT_SELECTION, RATE_LIMIT_DATA_SELECTION],
            variables: REPORT_VARIABLES,
          }),
          variables: {
            endTime: fight.endTime,
            reportCode,
            startTime,
          },
        },
        FellowshipLogsReportResponseDataSchema,
      );

      const pageResponseData = yield* getGraphQLResponseData(pageResponse);

      const reportPage = yield* getReportOrFail({
        report: pageResponseData.reportData.report,
        reportCode,
      });

      return [
        [{ pageResponse, reportPage }],
        Option.fromNullishOr(reportPage.events.nextPageTimestamp),
      ] as const;
    });
  });

  yield* reportPageStream.pipe(
    Stream.zipWithIndex,
    Stream.runForEach(([{ pageResponse, reportPage }, pageIndex]) => {
      return E.gen(function* () {
        const pageNumber = pageIndex + 1;
        const outputFileName = `page-${pageNumber}.json`;

        const resolvedOutputPath = path.join(
          resolvedOutputDirectory,
          outputFileName,
        );

        yield* fileSystem.writeFileString(
          resolvedOutputPath,
          stringifyFixture(pageResponse),
        );

        yield* E.logInfo("Captured Fellowship Logs report fixture page.", {
          eventCount: reportPage.events.data.length,
          nextPageTimestamp: reportPage.events.nextPageTimestamp,
          outputFilePath: resolvedOutputPath,
          pageNumber,
          reportCode,
        });
      });
    }),
  );
});
