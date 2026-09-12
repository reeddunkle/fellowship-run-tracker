import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";

import { appConfig } from "@/app-config.ts";
import { parseApiCLICommand } from "@/cli/api-cli/run-api-cli.ts";
import { makeApiLayer } from "@/layers/api-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

function runServeCommand() {
  return E.gen(function* () {
    const databaseFilename = yield* appConfig.databaseFilename;

    return yield* E.never.pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      E.provide(
        makeApiLayer({
          databaseFilename,
        }),
      ),
    );
  });
}

const program = parseApiCLICommand(process.argv.slice(2)).pipe(
  E.flatMap((command) => {
    return Match.value(command).pipe(
      Match.when({ type: "SERVE" }, runServeCommand),
      Match.exhaustive,
    );
  }),
  E.tapCause(logCause),
);

const exit = await E.runPromiseExit(program);

if (Exit.isFailure(exit)) {
  process.exitCode = 1;
}
