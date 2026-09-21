import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServer from "effect/unstable/http/HttpServer";

import { publishLiveSplitStatusChanges } from "@/api/websocket/live-split/publish-live-split-status-changes.ts";
import { publishTrackingStatusChanges } from "@/api/websocket/tracking/publish-tracking-status-changes.ts";

const runApiLifecycle = E.gen(function* () {
  const httpServer = yield* HttpServer.HttpServer;

  yield* E.logInfo("Fellowship API server running.", {
    address: HttpServer.formatAddress(httpServer.address),
  });

  yield* publishLiveSplitStatusChanges.pipe(E.forkScoped);
  yield* publishTrackingStatusChanges.pipe(E.forkScoped);
});

export const ApiLifecycleLayer = Layer.effectDiscard(runApiLifecycle);
