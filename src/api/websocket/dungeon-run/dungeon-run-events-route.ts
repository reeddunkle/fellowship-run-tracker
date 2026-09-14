import * as E from "effect/Effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Socket from "effect/unstable/socket/Socket";

import { ROUTES } from "@/api/constants/routes.ts";
import { DungeonRunWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";

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
        return writer(message);
      };

      yield* runWebSocketBroadcaster.registerClient(writeMessage);

      const clientCount = yield* runWebSocketBroadcaster.clientCount;

      yield* E.logInfo("DungeonRun WebSocket client connected.", {
        clientCount,
        url: request.url,
      });

      yield* socket
        .runRaw(
          () => {
            return E.void;
          },
          {
            onOpen: E.gen(function* () {
              yield* E.logDebug("DungeonRun WebSocket socket opened.", {
                url: request.url,
              });

              yield* runWebSocketBroadcaster.sendLatestToClient(writeMessage);
            }),
          },
        )
        .pipe(
          E.catchFilter(
            Socket.SocketCloseError.filterClean((code) => {
              return code === 1000;
            }),
            () => E.void,
          ),
        );
    }),
  ).pipe(
    E.ensuring(
      E.gen(function* () {
        const clientCount = yield* runWebSocketBroadcaster.clientCount;

        yield* E.logInfo("DungeonRun WebSocket client disconnected.", {
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
