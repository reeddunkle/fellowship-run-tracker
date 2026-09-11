import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";

import { parseApiCLICommand } from "@/cli/api-cli/run-api-cli.ts";
import { env } from "@/env.ts";
import { logCause } from "@/logging/log-cause.ts";
import { makeApiRuntime } from "@/runtimes/api-runtime.ts";

const commandExit = await E.runPromiseExit(
  parseApiCLICommand(process.argv.slice(2)).pipe(E.tapCause(logCause)),
);

if (Exit.isFailure(commandExit)) {
  process.exitCode = 1;
} else {
  const command = commandExit.value;

  const exit: Exit.Exit<never, unknown> = await Match.value(command).pipe(
    Match.when({ type: "SERVE" }, () => {
      const apiRuntime = makeApiRuntime({
        databaseFilename: env.databaseFilename,
      });

      return apiRuntime.runPromiseExit(E.never).finally(() => {
        return apiRuntime.dispose();
      });
    }),
    Match.exhaustive,
  );

  if (Exit.isFailure(exit)) {
    process.exitCode = 1;
  }
}
