// @effect-diagnostics-next-line nodeBuiltinImport:off
import * as Http from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { appConfig } from "@/app-config.ts";

const makeNodeApiHttpServer = E.gen(function* () {
  const host = yield* appConfig.publicApiHost;
  const port = yield* appConfig.publicApiPort;

  yield* E.annotateCurrentSpan("public.api.host", host);
  yield* E.annotateCurrentSpan("public.api.port", port);

  return NodeHttpServer.layer(Http.createServer, {
    host,
    port,
  });
});

export const NodeApiHttpServerLive = Layer.unwrap(makeNodeApiHttpServer);
