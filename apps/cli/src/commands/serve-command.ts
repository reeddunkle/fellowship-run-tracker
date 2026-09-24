import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";

import { getDatabaseOptions } from "@frt/api/helpers/get-database-options.ts";
import { ApiLayer } from "@frt/api/layers/api-layer.ts";
import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { logCause } from "@frt/api/logging/log-cause.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";

const ServeLayer = Layer.unwrap(
  E.map(getDatabaseOptions(), (databaseOptions) => {
    return ApiLayer.pipe(Layer.provide(makePersistenceLayer(databaseOptions)));
  }),
);

function runServeCommand() {
  return E.never.pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    E.provide(ServeLayer),
    E.tapCause(logCause),
  );
}

export const serveCommand = Command.make("serve", {}, runServeCommand).pipe(
  Command.withDescription(
    "Run the HTTP/WebSocket API on its own, without the Electron app.",
  ),
  Command.provide(AppLoggerLayer),
);
