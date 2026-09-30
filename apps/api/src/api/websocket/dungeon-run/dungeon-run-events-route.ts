import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleDungeonRunEventsRequest = E.gen(function* () {
  const broadcaster = yield* DungeonRunWebSocketBroadcaster;

  return yield* serveWebSocketClient({
    broadcaster,
    label: "DungeonRun",
  });
});

export const DungeonRunEventsRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    ROUTES.dungeonRunEvents,
    handleDungeonRunEventsRequest,
  ),
]);
