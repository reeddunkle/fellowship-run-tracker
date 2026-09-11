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

export type WebSocketBroadcasterService = {
  readonly clientCount: E.Effect<number>;

  readonly publish: (message: string) => E.Effect<void>;

  readonly registerClient: (
    writer: WebSocketWriter,
  ) => E.Effect<void, never, Scope.Scope>;

  readonly sendLatestToClient: (writer: WebSocketWriter) => E.Effect<void>;
};

export class DungeonRunWebSocketBroadcaster extends Context.Service<
  DungeonRunWebSocketBroadcaster,
  WebSocketBroadcasterService
>()(
  "fellowship-run-tracker/services/api/websocket-broadcaster-service/DungeonRunWebSocketBroadcaster",
) {}

export class TrackingWebSocketBroadcaster extends Context.Service<
  TrackingWebSocketBroadcaster,
  WebSocketBroadcasterService
>()(
  "fellowship-run-tracker/services/api/websocket-broadcaster-service/TrackingWebSocketBroadcaster",
) {}

export class LiveSplitWebSocketBroadcaster extends Context.Service<
  LiveSplitWebSocketBroadcaster,
  WebSocketBroadcasterService
>()(
  "fellowship-run-tracker/services/api/websocket-broadcaster-service/LiveSplitWebSocketBroadcaster",
) {}

const make = E.gen(function* () {
  const clients = yield* Ref.make(HashSet.empty<WebSocketWriter>());
  const latestMessage = yield* Ref.make<string | undefined>(undefined);

  const clientCount: WebSocketBroadcasterService["clientCount"] = Ref.get(
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

  const registerClient: WebSocketBroadcasterService["registerClient"] = (
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

  const sendLatestToClient: WebSocketBroadcasterService["sendLatestToClient"] =
    (writer: WebSocketWriter) => {
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

  const publish: WebSocketBroadcasterService["publish"] = (message: string) => {
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
  } satisfies WebSocketBroadcasterService;
});

export const DungeonRunWebSocketBroadcasterLive = Layer.effect(
  DungeonRunWebSocketBroadcaster,
  make,
);

export const TrackingWebSocketBroadcasterLive = Layer.effect(
  TrackingWebSocketBroadcaster,
  make,
);

export const LiveSplitWebSocketBroadcasterLive = Layer.effect(
  LiveSplitWebSocketBroadcaster,
  make,
);
