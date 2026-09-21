import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";

import { parseApiCLICommand } from "@/cli/api-cli/run-api-cli.ts";
import { getDatabaseFilename } from "@/helpers/get-database-filename.ts";
import { getEncryptionKeyDirectory } from "@/helpers/get-encryption-key-directory.ts";
import { makeApiLayer } from "@/layers/api-layer.ts";
import { NodePathLayer } from "@/layers/node-platform-layer.ts";
import { makePersistenceLayer } from "@/layers/persistence-layer.ts";
import { logCause } from "@/logging/log-cause.ts";

function runServeCommand() {
  return E.gen(function* () {
    const databaseFilename = yield* getDatabaseFilename();

    const PersistenceLayer = makePersistenceLayer({
      databaseFilename,
    });

    const ApiLayer = makeApiLayer({
      encryptionKeyDirectory: getEncryptionKeyDirectory(),
    }).pipe(Layer.provide(PersistenceLayer));

    return yield* E.never.pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      E.provide(ApiLayer),
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
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodePathLayer),
  E.tapCause(logCause),
);

const exit = await E.runPromiseExit(program);

if (Exit.isFailure(exit)) {
  process.exitCode = 1;
}
