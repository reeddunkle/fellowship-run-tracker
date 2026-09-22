import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { getDatabaseFilename } from "@frt/api/helpers/get-database-filename.ts";
import { makeApiLayer } from "@frt/api/layers/api-layer.ts";
import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { logCause } from "@frt/api/logging/log-cause.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";

const ServeLayer = Layer.unwrap(
  E.map(getDatabaseFilename(), (databaseFilename) => {
    return makeApiLayer({
      encryptionKeyDirectory: appPaths.encryptionKey,
    }).pipe(
      Layer.provide(
        makePersistenceLayer({
          databaseFilename,
        }),
      ),
    );
  }),
);

function runServeCommand() {
  return E.never.pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    E.provide(ServeLayer),
    E.tapCause(logCause),
  );
}

// The logger wraps the whole handler, so it also covers building the API
// layers; failures (e.g. the port being in use) are written to the log file.
export const serveCommand = Command.make("serve", {}, runServeCommand).pipe(
  Command.withDescription(
    "Run the HTTP/WebSocket API on its own, without the Electron app.",
  ),
  Command.provide(AppLoggerLayer),
);
