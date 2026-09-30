import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";
import { serveWebSocketClient } from "@frt/api/api/websocket/serve-websocket-client.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleDungeonRunEventsRequest = E.gen(function* () {
  const dungeonRunWebSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;

  return yield* serveWebSocketClient({
    label: "DungeonRun",
    messages: dungeonRunWebSocketBroadcaster.messages,
  });
});

export const DungeonRunEventsRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    ROUTES.dungeonRunEvents,
    handleDungeonRunEventsRequest,
  ),
]);
