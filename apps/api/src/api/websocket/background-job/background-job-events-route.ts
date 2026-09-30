import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { BackgroundJobWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleBackgroundJobRequest = E.gen(function* () {
  const broadcaster = yield* BackgroundJobWebSocketBroadcaster;

  return yield* serveWebSocketClient({
    broadcaster,
    label: "Background job",
  });
});

export const BackgroundJobRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    ROUTES.backgroundJobEvents,
    handleBackgroundJobRequest,
  ),
]);
