// @effect-diagnostics strictEffectProvide:off
import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import { appConfig } from "@/app-config.ts";
import { runBuildMilestoneConfigurationJsonSchemaCommand } from "@/cli/dev-cli/commands/build-milestone-configuration-json-schema-command.ts";
import { runCaptureFellowshipLogsReportCommand } from "@/cli/dev-cli/commands/capture-fellowship-logs-report-command.ts";
import { runGenerateFellowshipUnitCatalogCommand } from "@/cli/dev-cli/commands/generate-fellowship-unit-catalog-command.ts";
import { runReplayLogFileCommand } from "@/cli/dev-cli/commands/replay-log-file-command.ts";
import { runSetupDatabaseCommand } from "@/cli/dev-cli/commands/setup-database-command.ts";
import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { FellowshipLogsRequestError } from "@/errors/fellowship-logs-error.ts";
import { getDatabaseFilename } from "@/helpers/get-database-filename.ts";
import { NodePlatformWithHttpClientLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

import { parseDevCLICommand } from "./run-dev-cli.ts";

const program = parseDevCLICommand(process.argv.slice(2)).pipe(
  E.flatMap((command) => {
    return Match.value(command).pipe(
      Match.when({ type: "BUILD_CONFIGURATION_SCHEMA" }, ({ input }) => {
        return runBuildMilestoneConfigurationJsonSchemaCommand(input);
      }),
      Match.when({ type: "CAPTURE_FELLOWSHIP_LOGS_REPORT" }, ({ input }) => {
        return E.gen(function* () {
          const clientIdOption = yield* appConfig.fellowshipLogsClientId;
          const clientSecretOption =
            yield* appConfig.fellowshipLogsClientSecret;

          if (
            Option.isNone(clientIdOption) ||
            Option.isNone(clientSecretOption)
          ) {
            return yield* new FellowshipLogsRequestError({
              cause: new Error(
                "Fellowship Logs credentials are not configured in the environment.",
              ),
              operation: "GetAccessToken",
            });
          }

          return yield* runCaptureFellowshipLogsReportCommand({
            ...input,
            credentials: {
              clientId: clientIdOption.value,
              clientSecret: clientSecretOption.value,
            },
          });
        });
      }),
      Match.when({ type: "GENERATE_UNIT_CATALOG" }, ({ input }) => {
        return runGenerateFellowshipUnitCatalogCommand(input);
      }),
      Match.when({ type: "REPLAY_LOG" }, ({ input }) => {
        return E.gen(function* () {
          const databaseFilename = yield* getDatabaseFilename();

          return yield* runReplayLogFileCommand(input).pipe(
            E.provide(makeDatabaseLayer(databaseFilename)),
          );
        });
      }),
      Match.when({ type: "SETUP_DATABASE" }, () => {
        return E.gen(function* () {
          const databaseFilename = yield* getDatabaseFilename();

          return yield* runSetupDatabaseCommand().pipe(
            E.provide(makeDatabaseLayer(databaseFilename)),
          );
        });
      }),
      Match.exhaustive,
    );
  }),
  E.provide(NodePlatformWithHttpClientLive),
  E.tapCause(logCause),
);

const exit = await E.runPromiseExit(program);

if (Exit.isFailure(exit)) {
  // @effect-diagnostics-next-line globalConsole:off
  console.error(Cause.pretty(exit.cause));

  process.exitCode = 1;
}
