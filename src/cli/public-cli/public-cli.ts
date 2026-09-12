import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";

import { appConfig } from "@/app-config.ts";
import { runAutosplitCommand } from "@/cli/public-cli/commands/autosplit-command.ts";
import { runFilterLogCommand } from "@/cli/public-cli/commands/filter-log-command.ts";
import { runGenerateLSSCommand } from "@/cli/public-cli/commands/generate-lss-command.ts";
import { runSplitLogCommand } from "@/cli/public-cli/commands/split-log-command.ts";
import { parsePublicCLICommand } from "@/cli/public-cli/run-public-cli.ts";
import { makeAutosplitLayer } from "@/layers/autosplit-layer.ts";
import { makeGenerateLSSLayer } from "@/layers/generate-lss-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

const program = parsePublicCLICommand(process.argv.slice(2)).pipe(
  E.flatMap((command) => {
    return Match.value(command).pipe(
      Match.when({ type: "AUTOSPLIT" }, ({ input }) => {
        return E.gen(function* () {
          const databaseFilename = yield* appConfig.databaseFilename;

          return yield* runAutosplitCommand(input).pipe(
            // @effect-diagnostics-next-line strictEffectProvide:off
            E.provide(
              makeAutosplitLayer({
                databaseFilename,
              }),
            ),
          );
        });
      }),
      Match.when({ type: "FILTER_LOG" }, ({ input }) => {
        return runFilterLogCommand(input);
      }),
      Match.when({ type: "GENERATE_LSS" }, ({ input }) => {
        return E.gen(function* () {
          const databaseFilename = yield* appConfig.databaseFilename;

          return yield* runGenerateLSSCommand(input).pipe(
            // @effect-diagnostics-next-line strictEffectProvide:off
            E.provide(
              makeGenerateLSSLayer({
                databaseFilename,
              }),
            ),
          );
        });
      }),
      Match.when({ type: "SPLIT_LOG" }, ({ input }) => {
        return runSplitLogCommand(input);
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
