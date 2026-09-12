import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";

import { appConfig } from "@/app-config.ts";
import { runBuildMilestoneConfigurationJsonSchemaCommand } from "@/cli/dev-cli/commands/build-milestone-configuration-json-schema-command.ts";
import { runGenerateFellowshipUnitCatalogCommand } from "@/cli/dev-cli/commands/generate-fellowship-unit-catalog-command.ts";
import { runReplayLogFileCommand } from "@/cli/dev-cli/commands/replay-log-file-command.ts";
import { runSetupDatabaseCommand } from "@/cli/dev-cli/commands/setup-database-command.ts";
import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

import { parseDevCLICommand } from "./run-dev-cli.ts";

const program = parseDevCLICommand(process.argv.slice(2)).pipe(
  E.flatMap((command) => {
    return Match.value(command).pipe(
      Match.when({ type: "BUILD_CONFIGURATION_SCHEMA" }, ({ input }) => {
        return runBuildMilestoneConfigurationJsonSchemaCommand(input);
      }),
      Match.when({ type: "GENERATE_UNIT_CATALOG" }, ({ input }) => {
        return runGenerateFellowshipUnitCatalogCommand(input);
      }),
      Match.when({ type: "REPLAY_LOG" }, ({ input }) => {
        return E.gen(function* () {
          const databaseFilename = yield* appConfig.databaseFilename;

          return yield* runReplayLogFileCommand(input).pipe(
            // @effect-diagnostics-next-line strictEffectProvide:off
            E.provide(
              Layer.mergeAll(
                NodePlatformLive,
                makeDatabaseLayer(databaseFilename),
              ),
            ),
          );
        });
      }),
      Match.when({ type: "SETUP_DATABASE" }, () => {
        return E.gen(function* () {
          const databaseFilename = yield* appConfig.databaseFilename;

          return yield* runSetupDatabaseCommand().pipe(
            // @effect-diagnostics-next-line strictEffectProvide:off
            E.provide(
              Layer.mergeAll(
                NodePlatformLive,
                makeDatabaseLayer(databaseFilename),
              ),
            ),
          );
        });
      }),
      Match.exhaustive,
    );
  }),
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodePlatformLive),
  E.tapCause(logCause),
);

const exit = await E.runPromiseExit(program);

if (Exit.isFailure(exit)) {
  // @effect-diagnostics-next-line globalConsole:off
  console.error(Cause.pretty(exit.cause));

  process.exitCode = 1;
}
