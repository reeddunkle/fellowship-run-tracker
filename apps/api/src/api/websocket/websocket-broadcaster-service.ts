import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type * as Scope from "effect/Scope";
import type * as Socket from "effect/unstable/socket/Socket";

export type WebSocketWriter = (
  message: string,
) => E.Effect<void, Socket.SocketError>;

export type WebSocketBroadcasterShape = {
  readonly clientCount: E.Effect<number>;

  readonly publish: (message: string) => E.Effect<void>;

  readonly registerClient: (
    writer: WebSocketWriter,
  ) => E.Effect<void, never, Scope.Scope>;

  readonly sendLatestToClient: (writer: WebSocketWriter) => E.Effect<void>;
};

const makeWebSocketBroadcaster = E.gen(function* () {
  const clients = yield* Ref.make(HashSet.empty<WebSocketWriter>());
  const latestMessage = yield* Ref.make<string | undefined>(undefined);

  const clientCount: WebSocketBroadcasterShape["clientCount"] = Ref.get(
    clients,
  ).pipe(
    E.map((currentClients) => {
      return HashSet.size(currentClients);
    }),
  );

  const removeClient = (writer: WebSocketWriter): E.Effect<void> => {
    return Ref.update(clients, (currentClients) => {
      return HashSet.remove(currentClients, writer);
    });
  };

  const writeToClient = ({
    message,
    writer,
  }: {
    readonly message: string;
    readonly writer: WebSocketWriter;
  }): E.Effect<void> => {
    return writer(message).pipe(
      E.catch((error) => {
        return E.gen(function* () {
          yield* removeClient(writer);

          yield* E.logWarning("WebSocket client write failed.", {
            error,
          });
        });
      }),
    );
  };

  const registerClient: WebSocketBroadcasterShape["registerClient"] = (
    writer: WebSocketWriter,
  ) => {
    return E.acquireRelease(
      Ref.update(clients, (currentClients) => {
        return HashSet.add(currentClients, writer);
      }),
      () => {
        return removeClient(writer);
      },
    );
  };

  const sendLatestToClient: WebSocketBroadcasterShape["sendLatestToClient"] = (
    writer: WebSocketWriter,
  ) => {
    return E.gen(function* () {
      const message = yield* Ref.get(latestMessage);

      if (message === undefined) {
        return;
      }

      yield* writeToClient({
        message,
        writer,
      });
    });
  };

  const publish: WebSocketBroadcasterShape["publish"] = (message: string) => {
    return E.gen(function* () {
      yield* Ref.set(latestMessage, message);

      const connectedClients = yield* Ref.get(clients);

      yield* E.forEach(
        connectedClients,
        (writer) => {
          return writeToClient({
            message,
            writer,
          });
        },
        {
          concurrency: "unbounded",
          discard: true,
        },
      );
    });
  };

  return {
    clientCount,
    publish,
    registerClient,
    sendLatestToClient,
  } satisfies WebSocketBroadcasterShape;
});

export class BackgroundJobWebSocketBroadcaster extends Context.Service<
  BackgroundJobWebSocketBroadcaster,
  WebSocketBroadcasterShape
>()(
  "@frt/api/api/websocket/websocket-broadcaster-service/BackgroundJobWebSocketBroadcaster",
) {
  static readonly layer = Layer.effect(this, makeWebSocketBroadcaster);
}

export class DungeonRunWebSocketBroadcaster extends Context.Service<
  DungeonRunWebSocketBroadcaster,
  WebSocketBroadcasterShape
>()(
  "@frt/api/api/websocket/websocket-broadcaster-service/DungeonRunWebSocketBroadcaster",
) {
  static readonly layer = Layer.effect(this, makeWebSocketBroadcaster);
}

export class TrackingWebSocketBroadcaster extends Context.Service<
  TrackingWebSocketBroadcaster,
  WebSocketBroadcasterShape
>()(
  "@frt/api/api/websocket/websocket-broadcaster-service/TrackingWebSocketBroadcaster",
) {
  static readonly layer = Layer.effect(this, makeWebSocketBroadcaster);
}

export class LiveSplitWebSocketBroadcaster extends Context.Service<
  LiveSplitWebSocketBroadcaster,
  WebSocketBroadcasterShape
>()(
  "@frt/api/api/websocket/websocket-broadcaster-service/LiveSplitWebSocketBroadcaster",
) {
  static readonly layer = Layer.effect(this, makeWebSocketBroadcaster);
}
