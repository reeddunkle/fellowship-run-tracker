// @effect-diagnostics-next-line nodeBuiltinImport:off
import * as Http from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { appConfig } from "@frt/api/app-config.ts";

export const API_SERVER_GRACEFUL_SHUTDOWN_TIMEOUT = Duration.seconds(3);

const makeNodeApiHttpServer = E.gen(function* () {
  const host = yield* appConfig.publicApiHost;
  const port = yield* appConfig.publicApiPort;

  return NodeHttpServer.layer(Http.createServer, {
    gracefulShutdownTimeout: API_SERVER_GRACEFUL_SHUTDOWN_TIMEOUT,
    host,
    port,
  });
});

export const NodeApiHttpServerLayer = Layer.unwrap(makeNodeApiHttpServer);
