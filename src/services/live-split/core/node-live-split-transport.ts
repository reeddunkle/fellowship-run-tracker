import * as NodeSocket from "@effect/platform-node/NodeSocket";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Match from "effect/Match";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import type * as Socket from "effect/unstable/socket/Socket";

type LiveSplitTransportChunk =
  | {
      readonly data: string;
      readonly type: "CHUNK";
    }
  | {
      readonly exit: Exit.Exit<void, Socket.SocketError>;
      readonly type: "END";
    };

export type LiveSplitTransport = {
  readonly chunks: Stream.Stream<string, Socket.SocketError>;
  readonly connected: E.Effect<void, Socket.SocketError>;
  readonly write: (data: string) => E.Effect<void, Socket.SocketError>;
};

export type MakeNodeLiveSplitTransportOptions = {
  readonly host: string;
  readonly port: number;
};

const SOCKET_OPEN_TIMEOUT = "5 seconds";

export const makeNodeLiveSplitTransport = E.fn("livesplit.connect")(function* ({
  host,
  port,
}: MakeNodeLiveSplitTransportOptions) {
  yield* E.annotateCurrentSpan("livesplit.host", host);
  yield* E.annotateCurrentSpan("livesplit.port", port);

  yield* E.logDebug("Creating LiveSplit TCP transport.", {
    host,
    port,
  });

  const socket = yield* NodeSocket.makeNet({
    host,
    openTimeout: SOCKET_OPEN_TIMEOUT,
    port,
  }).pipe(
    E.tap(() => {
      return E.logDebug("Created LiveSplit TCP socket.", {
        host,
        port,
      });
    }),
    E.tapCause((cause) => {
      return E.logError("Failed to create LiveSplit TCP socket.", {
        cause,
        host,
        port,
      });
    }),
  );

  const socketWriter = yield* socket.writer;

  const connectedDeferred = yield* Deferred.make<void, Socket.SocketError>();

  const chunksQueue = yield* Queue.unbounded<LiveSplitTransportChunk>();

  const socketEffect = socket
    .runString(
      (socketChunk) => {
        return Queue.offer(chunksQueue, {
          data: socketChunk,
          type: "CHUNK",
        }).pipe(E.asVoid);
      },
      {
        onOpen: E.gen(function* () {
          yield* E.logInfo("LiveSplit TCP connection opened.", {
            host,
            port,
          });

          yield* Deferred.succeed(connectedDeferred, undefined);
        }),
      },
    )
    .pipe(
      E.tapError((error) => {
        return Deferred.fail(connectedDeferred, error);
      }),
      E.exit,
      E.tap((exit) => {
        return Queue.offer(chunksQueue, {
          exit,
          type: "END",
        });
      }),
      E.tap((exit) => {
        return Exit.match(exit, {
          onFailure: (cause) => {
            return E.logError("LiveSplit TCP connection failed.", {
              cause,
              host,
              port,
            });
          },
          onSuccess: () => {
            return E.logDebug("LiveSplit TCP connection ended.", {
              host,
              port,
            });
          },
        });
      }),
      E.asVoid,
    );

  yield* socketEffect.pipe(E.forkScoped);

  const chunks: LiveSplitTransport["chunks"] = Stream.fromQueue(
    chunksQueue,
  ).pipe(
    Stream.takeUntilEffect((item) => {
      return E.succeed(item.type === "END");
    }),
    Stream.mapEffect(
      Match.type<LiveSplitTransportChunk>().pipe(
        Match.when({ type: "CHUNK" }, ({ data }) => {
          return E.succeed(data);
        }),
        Match.when({ type: "END" }, ({ exit }) => {
          return Exit.match(exit, {
            onFailure: (cause) => {
              return E.failCause(cause);
            },
            onSuccess: () => {
              return E.die("Unexpected terminal LiveSplit transport item.");
            },
          });
        }),
        Match.exhaustive,
      ),
    ),
  );

  const connected: LiveSplitTransport["connected"] =
    Deferred.await(connectedDeferred);

  return {
    chunks,
    connected,

    write: (data) => {
      return socketWriter(data).pipe(
        E.tapCause((cause) => {
          return E.logError("LiveSplit TCP write failed.", {
            cause,
            host,
            port,
          });
        }),
      );
    },
  } satisfies LiveSplitTransport;
});
