import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { TrackingWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleTrackingRequest = E.gen(function* () {
  const broadcaster = yield* TrackingWebSocketBroadcaster;

  return yield* serveWebSocketClient({
    broadcaster,
    label: "Tracking",
  });
});

export const TrackingRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.trackingEvents, handleTrackingRequest),
]);
