import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { WebSocketChannel } from "@frt/api/api/websocket/websocket-channel-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleTrackingRequest = E.gen(function* () {
  const webSocketChannel = yield* WebSocketChannel;

  return yield* serveWebSocketClient({
    label: "Tracking",
    messages: webSocketChannel.messages("tracking"),
  });
});

export const TrackingRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.trackingEvents, handleTrackingRequest),
]);
