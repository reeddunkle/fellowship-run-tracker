import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Match from "effect/Match";

import { runBuildMilestoneConfigurationJsonSchemaCommand } from "@/cli/dev-cli/commands/build-milestone-configuration-json-schema-command.ts";
import { runGenerateFellowshipUnitCatalogCommand } from "@/cli/dev-cli/commands/generate-fellowship-unit-catalog-command.ts";
import { runReplayLogFileCommand } from "@/cli/dev-cli/commands/replay-log-file-command.ts";
import { runSetupDatabaseCommand } from "@/cli/dev-cli/commands/setup-database-command.ts";
import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { env } from "@/env.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

import { parseDevCLICommand } from "./run-dev-cli.ts";

const devCLIRuntime = ManagedRuntime.make(NodePlatformLive);

const commandExit = await devCLIRuntime.runPromiseExit(
  parseDevCLICommand(process.argv.slice(2)).pipe(E.tapCause(logCause)),
);

if (Exit.isFailure(commandExit)) {
  // @effect-diagnostics-next-line globalConsole:off
  console.error(Cause.pretty(commandExit.cause));

  process.exitCode = 1;
} else {
  const command = commandExit.value;

  const exit: Exit.Exit<undefined, unknown> = await Match.value(command).pipe(
    Match.when({ type: "BUILD_CONFIGURATION_SCHEMA" }, ({ input }) => {
      return devCLIRuntime.runPromiseExit(
        runBuildMilestoneConfigurationJsonSchemaCommand(input).pipe(
          E.tapCause(logCause),
          E.as(undefined),
        ),
      );
    }),
    Match.when({ type: "GENERATE_UNIT_CATALOG" }, ({ input }) => {
      return devCLIRuntime.runPromiseExit(
        runGenerateFellowshipUnitCatalogCommand(input).pipe(
          E.tapCause(logCause),
          E.as(undefined),
        ),
      );
    }),
    Match.when({ type: "REPLAY_LOG" }, ({ input }) => {
      const DatabaseCLILive = Layer.mergeAll(
        NodePlatformLive,
        makeDatabaseLayer(env.databaseFilename),
      );

      const databaseCLIRuntime = ManagedRuntime.make(DatabaseCLILive);

      return databaseCLIRuntime
        .runPromiseExit(
          runReplayLogFileCommand(input).pipe(
            E.tapCause(logCause),
            E.as(undefined),
          ),
        )
        .finally(() => {
          return databaseCLIRuntime.dispose();
        });
    }),
    Match.when({ type: "SETUP_DATABASE" }, () => {
      const DatabaseCLILive = Layer.mergeAll(
        NodePlatformLive,
        makeDatabaseLayer(env.databaseFilename),
      );

      const databaseCLIRuntime = ManagedRuntime.make(DatabaseCLILive);

      return databaseCLIRuntime
        .runPromiseExit(
          runSetupDatabaseCommand().pipe(E.tapCause(logCause), E.as(undefined)),
        )
        .finally(() => {
          return databaseCLIRuntime.dispose();
        });
    }),
    Match.exhaustive,
  );

  if (Exit.isFailure(exit)) {
    // @effect-diagnostics-next-line globalConsole:off
    console.error(Cause.pretty(exit.cause));

    process.exitCode = 1;
  }
}

await devCLIRuntime.dispose();
