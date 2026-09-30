import * as E from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { type WebSocketBroadcasterShape } from "@frt/api/api/websocket/websocket-broadcaster-service.ts";

type ServeWebSocketClientOptions = {
  readonly broadcaster: WebSocketBroadcasterShape;
  readonly label: string;
};

export const serveWebSocketClient = E.fn(function* ({
  broadcaster,
  label,
}: ServeWebSocketClientOptions) {
  const request = yield* HttpServerRequest.HttpServerRequest;

  yield* E.logDebug(`${label} WebSocket upgrade requested.`, {
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

      yield* broadcaster.registerClient(writeMessage);

      const { pull } = yield* socket.reader;

      yield* E.logDebug(`${label} WebSocket client connected.`, {
        url: request.url,
      });

      yield* broadcaster.sendLatestToClient(writeMessage);

      yield* pull.pipe(
        E.forever,
        E.catchReason("SocketError", "SocketCloseError", (reason, error) => {
          return reason.code === 1000 ? E.void : E.fail(error);
        }),
      );
    }),
  ).pipe(
    E.ensuring(
      E.logDebug(`${label} WebSocket client disconnected.`, {
        url: request.url,
      }),
    ),
  );

  return HttpServerResponse.empty();
});
