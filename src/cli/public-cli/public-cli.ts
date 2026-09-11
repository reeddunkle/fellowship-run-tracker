import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Match from "effect/Match";

import { runAutosplitCommand } from "@/cli/public-cli/commands/autosplit-command.ts";
import { runFilterLogCommand } from "@/cli/public-cli/commands/filter-log-command.ts";
import { runGenerateLSSCommand } from "@/cli/public-cli/commands/generate-lss-command.ts";
import { runSplitLogCommand } from "@/cli/public-cli/commands/split-log-command.ts";
import { parsePublicCLICommand } from "@/cli/public-cli/run-public-cli.ts";
import { env } from "@/env.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";
import {
  makeAutosplitRuntime,
  makeGenerateLSSRuntime,
} from "@/runtimes/public-cli-runtime.ts";

const platformRuntime = ManagedRuntime.make(NodePlatformLive);

const commandExit = await platformRuntime.runPromiseExit(
  parsePublicCLICommand(process.argv.slice(2)).pipe(E.tapCause(logCause)),
);

if (Exit.isFailure(commandExit)) {
  // @effect-diagnostics-next-line globalConsole:off
  console.error(Cause.pretty(commandExit.cause));

  process.exitCode = 1;
} else {
  const command = commandExit.value;

  const exit: Exit.Exit<undefined, unknown> = await Match.value(command).pipe(
    Match.when({ type: "AUTOSPLIT" }, ({ input }) => {
      const autosplitRuntime = makeAutosplitRuntime({
        databaseFilename: env.databaseFilename,
      });

      return autosplitRuntime
        .runPromiseExit(
          runAutosplitCommand(input).pipe(
            E.tapCause(logCause),
            E.as(undefined),
          ),
        )
        .finally(() => {
          return autosplitRuntime.dispose();
        });
    }),
    Match.when({ type: "FILTER_LOG" }, ({ input }) => {
      return platformRuntime.runPromiseExit(
        runFilterLogCommand(input).pipe(E.tapCause(logCause), E.as(undefined)),
      );
    }),
    Match.when({ type: "GENERATE_LSS" }, ({ input }) => {
      const generateLSSRuntime = makeGenerateLSSRuntime({
        databaseFilename: env.databaseFilename,
      });

      return generateLSSRuntime
        .runPromiseExit(
          runGenerateLSSCommand(input).pipe(
            E.tapCause(logCause),
            E.as(undefined),
          ),
        )
        .finally(() => {
          return generateLSSRuntime.dispose();
        });
    }),
    Match.when({ type: "SPLIT_LOG" }, ({ input }) => {
      return platformRuntime.runPromiseExit(
        runSplitLogCommand(input).pipe(E.tapCause(logCause), E.as(undefined)),
      );
    }),
    Match.exhaustive,
  );

  if (Exit.isFailure(exit)) {
    // @effect-diagnostics-next-line globalConsole:off
    console.error(Cause.pretty(exit.cause));

    process.exitCode = 1;
  }
}

await platformRuntime.dispose();
