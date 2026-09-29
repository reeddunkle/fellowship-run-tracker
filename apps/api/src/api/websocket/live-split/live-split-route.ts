import * as E from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { LiveSplitWebSocketBroadcaster } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const handleLiveSplitRequest = E.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const liveSplitWebSocketBroadcaster = yield* LiveSplitWebSocketBroadcaster;

  yield* E.logDebug("LiveSplit WebSocket upgrade requested.", {
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

      yield* liveSplitWebSocketBroadcaster.registerClient(writeMessage);

      const { pull } = yield* socket.reader;

      yield* E.logDebug("LiveSplit WebSocket client connected.", {
        url: request.url,
      });

      yield* liveSplitWebSocketBroadcaster.sendLatestToClient(writeMessage);

      yield* pull.pipe(
        E.forever,
        E.catchReason("SocketError", "SocketCloseError", (reason, error) => {
          return reason.code === 1000 ? E.void : E.fail(error);
        }),
      );
    }),
  ).pipe(
    E.ensuring(
      E.logDebug("LiveSplit WebSocket client disconnected.", {
        url: request.url,
      }),
    ),
  );

  return HttpServerResponse.empty();
});

export const LiveSplitRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.liveSplitEvents, handleLiveSplitRequest),
]);
