import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { LiveSplitWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleLiveSplitRequest = E.gen(function* () {
  const broadcaster = yield* LiveSplitWebSocketBroadcaster;

  return yield* serveWebSocketClient({
    broadcaster,
    label: "LiveSplit",
  });
});

export const LiveSplitRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.liveSplitEvents, handleLiveSplitRequest),
]);
