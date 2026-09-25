import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import { appConfig } from "@frt/api/app-config.ts";
import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
  getFellowshipLogsReportFixtureDirectory,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-fixture-paths.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { type FellowshipLogsGatewayCredentials } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  findFightOrFail,
  getGraphQLResponseData,
  getReportOrFail,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-response-helpers.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import {
  REPORT_SELECTION,
  REPORT_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsRateLimitResponseDataSchema } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

type CaptureFellowshipLogsReportCommandInput = {
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputFilePath: string | undefined;
  readonly reportCode: typeof FellowshipLogsReportCodeSchema.Type;
};

type CaptureFellowshipLogsReportOptions =
  CaptureFellowshipLogsReportCommandInput & {
    readonly credentials: FellowshipLogsGatewayCredentials;
  };

function stringifyFixture(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const captureFellowshipLogsReport = E.fn("cli.capture-fellowship-logs-report")(
  function* ({
    credentials,
    fightId,
    outputFilePath,
    reportCode,
  }: CaptureFellowshipLogsReportOptions) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const query = yield* makeFellowshipLogsGatewayHttpQuery(() => {
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

    const metadataResponse = yield* query(
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

    const metadataResponseData =
      yield* getGraphQLResponseData(metadataResponse);

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
          FellowshipLogsGatewayReportResponseDataSchema,
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
  },
);

const runCaptureFellowshipLogsReportCommand = E.fn(
  "cli.capture-fellowship-logs-report.credentials",
)(function* (input: CaptureFellowshipLogsReportCommandInput) {
  const clientIdOption = yield* appConfig.fellowshipLogsClientId;
  const clientSecretOption = yield* appConfig.fellowshipLogsClientSecret;

  if (Option.isNone(clientIdOption) || Option.isNone(clientSecretOption)) {
    return yield* new FellowshipLogsGatewayRequestError({
      cause: new Error(
        "Fellowship Logs credentials are not configured in the environment.",
      ),
      operation: "GetAccessToken",
    });
  }

  return yield* captureFellowshipLogsReport({
    ...input,
    credentials: {
      clientId: clientIdOption.value,
      clientSecret: clientSecretOption.value,
    },
  });
});

export const captureFellowshipLogsReportCommand = Command.make(
  "capture-fellowship-logs-report",
  {
    fightId: Flag.integer("fight-id").pipe(
      Flag.withSchema(FellowshipLogsFightIdSchema),
      Flag.withDescription("Fight ID within the report."),
    ),
    outputFilePath: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.optional,
      Flag.map(Option.getOrUndefined),
      Flag.withDescription(
        "Fixture directory to write (defaults to the Fellowship Logs fixtures directory).",
      ),
    ),
    reportCode: Flag.string("report-code").pipe(
      Flag.withSchema(FellowshipLogsReportCodeSchema),
      Flag.withDescription("Fellowship Logs report code."),
    ),
  },
  runCaptureFellowshipLogsReportCommand,
).pipe(
  Command.withDescription(
    "Capture a Fellowship Logs report as JSON test fixtures (uses the client ID and secret from .env).",
  ),
  Command.provide(NodeHttpClientLayer),
);
