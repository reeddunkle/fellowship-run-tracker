import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { WebSocketChannel } from "@frt/api/api/websocket/websocket-channel-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleBackgroundJobRequest = E.gen(function* () {
  const webSocketChannel = yield* WebSocketChannel;

  return yield* serveWebSocketClient({
    label: "Background job",
    messages: webSocketChannel.messages("backgroundJob"),
  });
});

export const BackgroundJobRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    ROUTES.backgroundJobEvents,
    handleBackgroundJobRequest,
  ),
]);
