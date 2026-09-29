import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleDungeonRunEventsRequest = E.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const runWebSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;

  yield* E.logDebug("DungeonRun WebSocket upgrade requested.", {
    method: request.method,
    url: request.url,
  });

  yield* E.scoped(
    E.gen(function* () {
      const socket = yield* request.upgrade;
      const writer = yield* socket.writer;

      const writeMessage = (message: string) => {
        return writer.write(message);
      };

      yield* runWebSocketBroadcaster.registerClient(writeMessage);

      const clientCount = yield* runWebSocketBroadcaster.clientCount;

      yield* E.logDebug("DungeonRun WebSocket client connected.", {
        clientCount,
        url: request.url,
      });

      const { pull } = yield* socket.reader;

      yield* E.logDebug("DungeonRun WebSocket socket opened.", {
        url: request.url,
      });

      yield* runWebSocketBroadcaster.sendLatestToClient(writeMessage);

      yield* pull.pipe(
        E.forever,
        E.catchReason("SocketError", "SocketCloseError", (reason, error) => {
          return reason.code === 1000 ? E.void : E.fail(error);
        }),
      );
    }),
  ).pipe(
    E.ensuring(
      E.gen(function* () {
        const clientCount = yield* runWebSocketBroadcaster.clientCount;

        yield* E.logDebug("DungeonRun WebSocket client disconnected.", {
          clientCount,
          url: request.url,
        });
      }),
    ),
  );

  return HttpServerResponse.empty();
});

export const DungeonRunEventsRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    ROUTES.dungeonRunEvents,
    handleDungeonRunEventsRequest,
  ),
]);
