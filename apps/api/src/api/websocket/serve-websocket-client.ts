import * as E from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Stream from "effect/Stream";

type ServeWebSocketClientOptions = {
  readonly label: string;
  readonly messages: Stream.Stream<string>;
};

export const serveWebSocketClient = E.fn(function* ({
  label,
  messages,
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
      const { pull } = yield* socket.reader;

      yield* E.logDebug(`${label} WebSocket client connected.`, {
        url: request.url,
      });

      const writeMessages = messages.pipe(
        Stream.runForEach((message) => {
          return writer.write(message);
        }),
        E.catch((error) => {
          return E.logDebug(
            `${label} WebSocket client write failed; closing the connection.`,
            {
              error,
              url: request.url,
            },
          );
        }),
      );

      const readUntilClosed = pull.pipe(
        E.forever,
        E.catchReason("SocketError", "SocketCloseError", () => {
          return E.void;
        }),
      );

      yield* E.raceFirst(writeMessages, readUntilClosed);
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
