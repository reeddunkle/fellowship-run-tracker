import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as HttpServer from "effect/http/HttpServer";
import * as Queue from "effect/Queue";

export class WebSocketOpenError extends Data.TaggedError("WebSocketOpenError") {
  override get message() {
    return "The WebSocket failed to open.";
  }
}

export class WebSocketMessageError extends Data.TaggedError(
  "WebSocketMessageError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to read a WebSocket message.";
  }
}

export function waitForWebSocketOpen(
  websocket: WebSocket,
): E.Effect<void, WebSocketOpenError> {
  return E.callback<void, WebSocketOpenError>((resume) => {
    const handleOpen = () => {
      resume(E.void);
    };

    const handleError = () => {
      resume(E.fail(new WebSocketOpenError()));
    };

    websocket.addEventListener("open", handleOpen, {
      once: true,
    });

    websocket.addEventListener("error", handleError, {
      once: true,
    });

    return E.sync(() => {
      websocket.removeEventListener("open", handleOpen);
      websocket.removeEventListener("error", handleError);
    });
  });
}

export const makeWebSocketMessageAwaiter = E.fnUntraced(function* (
  websocket: WebSocket,
) {
  const messageDeferred = yield* Deferred.make<string, WebSocketMessageError>();

  const handleMessage = (event: MessageEvent) => {
    Deferred.doneUnsafe(messageDeferred, E.succeed(String(event.data)));
  };

  const handleError = (cause: Event) => {
    Deferred.doneUnsafe(
      messageDeferred,
      E.fail(
        new WebSocketMessageError({
          cause,
        }),
      ),
    );
  };

  yield* E.acquireRelease(
    E.sync(() => {
      websocket.addEventListener("message", handleMessage, {
        once: true,
      });

      websocket.addEventListener("error", handleError, {
        once: true,
      });
    }),
    () => {
      return E.sync(() => {
        websocket.removeEventListener("message", handleMessage);
        websocket.removeEventListener("error", handleError);
      });
    },
  );

  // Returning the Effect is intentional: the listener is installed now,
  // while the caller waits for the message after publishing.
  // @effect-diagnostics-next-line returnEffectInGen:off
  return Deferred.await(messageDeferred);
});

export const collectWebSocketMessages = E.fnUntraced(function* (
  websocket: WebSocket,
) {
  const messages = yield* Queue.unbounded<string>();

  const handleMessage = (event: MessageEvent) => {
    Queue.offerUnsafe(messages, String(event.data));
  };

  yield* E.acquireRelease(
    E.sync(() => {
      websocket.addEventListener("message", handleMessage);
    }),
    () => {
      return E.sync(() => {
        websocket.removeEventListener("message", handleMessage);
      });
    },
  );

  return messages;
});

function closeWebSocket(websocket: WebSocket): E.Effect<void> {
  return E.callback<void>((resume) => {
    if (websocket.readyState === WebSocket.CLOSED) {
      resume(E.void);

      return;
    }

    const handleClose = () => {
      resume(E.void);
    };

    websocket.addEventListener("close", handleClose, {
      once: true,
    });

    websocket.close();

    return E.sync(() => {
      websocket.removeEventListener("close", handleClose);
    });
  });
}

export function getWebSocketUrl({
  httpServer,
  route,
}: {
  readonly httpServer: HttpServer.HttpServer["Service"];
  readonly route: string;
}): string {
  return `${HttpServer.formatAddress(httpServer.address)
    .replace(/^http:/, "ws:")
    .replace("0.0.0.0", "127.0.0.1")}${route}`;
}

export function openWebSocket(url: string) {
  return E.acquireRelease(
    E.sync(() => {
      return new WebSocket(url);
    }),
    closeWebSocket,
  );
}
