import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";

import { runAutosplitCommand } from "@/cli/public-cli/commands/autosplit-command.ts";
import { runFilterLogCommand } from "@/cli/public-cli/commands/filter-log-command.ts";
import { runGenerateLSSCommand } from "@/cli/public-cli/commands/generate-lss-command.ts";
import { runSplitLogCommand } from "@/cli/public-cli/commands/split-log-command.ts";
import { parsePublicCLICommand } from "@/cli/public-cli/run-public-cli.ts";
import { getDatabaseFilename } from "@/helpers/get-database-filename.ts";
import { getEncryptionKeyDirectory } from "@/helpers/get-encryption-key-directory.ts";
import { makeAutosplitLayer } from "@/layers/autosplit-layer.ts";
import { NodePlatformLayer } from "@/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { logCause } from "@/logging/log-cause.ts";
import { LiveSplitFile } from "@/services/live-split/files/live-split-file-service.ts";

const program = E.gen(function* () {
  const command = yield* parsePublicCLICommand(process.argv.slice(2));

  return yield* Match.value(command).pipe(
    Match.when({ type: "AUTOSPLIT" }, ({ input }) => {
      return E.gen(function* () {
        const databaseFilename = yield* getDatabaseFilename();

        const PersistenceLayer = makePersistenceLayer({
          databaseFilename,
        });

        const AutosplitLayer = makeAutosplitLayer({
          encryptionKeyDirectory: getEncryptionKeyDirectory(),
        }).pipe(Layer.provide(PersistenceLayer));

        const AutosplitWithDependenciesLayer = Layer.mergeAll(
          PersistenceLayer,
          AutosplitLayer,
        );

        return yield* runAutosplitCommand(input).pipe(
          // @effect-diagnostics-next-line strictEffectProvide:off
          E.provide(AutosplitWithDependenciesLayer),
        );
      });
    }),
    Match.when({ type: "FILTER_LOG" }, ({ input }) => {
      return runFilterLogCommand(input);
    }),
    Match.when({ type: "GENERATE_LSS" }, ({ input }) => {
      return E.gen(function* () {
        const databaseFilename = yield* getDatabaseFilename();

        const PersistenceLayer = makePersistenceLayer({
          databaseFilename,
        });

        const GenerateLSSWithDependenciesLayer = Layer.mergeAll(
          PersistenceLayer,
          LiveSplitFile.layer,
        );

        return yield* runGenerateLSSCommand(input).pipe(
          // @effect-diagnostics-next-line strictEffectProvide:off
          E.provide(GenerateLSSWithDependenciesLayer),
        );
      });
    }),
    Match.when({ type: "SPLIT_LOG" }, ({ input }) => {
      return runSplitLogCommand(input);
    }),
    Match.exhaustive,
  );
}).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodePlatformLayer),
  E.tapCause(logCause),
);

const exit = await E.runPromiseExit(program);

if (Exit.isFailure(exit)) {
  // @effect-diagnostics-next-line globalConsole:off
  console.error(Cause.pretty(exit.cause));

  process.exitCode = 1;
}
