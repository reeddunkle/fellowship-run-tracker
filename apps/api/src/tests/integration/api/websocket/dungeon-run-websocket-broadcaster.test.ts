import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as HttpServer from "effect/unstable/http/HttpServer";
import { describe, expect, test } from "vitest";

import {
  DungeonRunWebSocketBroadcaster,
  type WebSocketBroadcasterService,
} from "@frt/api/services/api/websocket-broadcaster-service.ts";
import {
  ApiServicesTest,
  makeApiServerTestLayer,
} from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const MOCK_TIMEOUT = "1 second";

const ApiServerTest = makeApiServerTestLayer(ApiServicesTest);

class WebSocketOpenError extends Data.TaggedError("WebSocketOpenError") {
  override get message() {
    return "The WebSocket failed to open.";
  }
}

class WebSocketMessageError extends Data.TaggedError("WebSocketMessageError")<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to read a WebSocket message.";
  }
}

function waitForWebSocketOpen(
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

function makeWebSocketMessageAwaiter(websocket: WebSocket) {
  return E.gen(function* () {
    const messageDeferred = yield* Deferred.make<
      string,
      WebSocketMessageError
    >();

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
}

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

function waitForClientCount({
  clientCount,
  webSocketBroadcaster,
}: {
  readonly clientCount: number;
  readonly webSocketBroadcaster: WebSocketBroadcasterService;
}): E.Effect<void> {
  return E.gen(function* () {
    while ((yield* webSocketBroadcaster.clientCount) !== clientCount) {
      yield* E.sleep("1 millis");
    }
  });
}

describe("DungeonRunWebSocketBroadcaster integration", () => {
  test("registers, publishes to, and unregisters a dungeon run WebSocket client", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const httpServer = yield* HttpServer.HttpServer;

        const address = HttpServer.formatAddress(httpServer.address);

        const websocketUrl = `${address
          .replace(/^http:/, "ws:")
          .replace("0.0.0.0", "127.0.0.1")}${ROUTES.dungeonRunEvents}`;

        const websocket = yield* E.acquireRelease(
          E.sync(() => {
            return new WebSocket(websocketUrl);
          }),
          closeWebSocket,
        );

        yield* waitForWebSocketOpen(websocket).pipe(E.timeout(MOCK_TIMEOUT));

        yield* waitForClientCount({
          clientCount: 1,
          webSocketBroadcaster,
        }).pipe(E.timeout(MOCK_TIMEOUT));

        expect(yield* webSocketBroadcaster.clientCount).toBe(1);

        /*
         * Acquire the listener before publishing so the response cannot
         * arrive before the native message handler is installed.
         */
        const awaitMessage = yield* makeWebSocketMessageAwaiter(websocket);

        yield* webSocketBroadcaster
          .publish("hello")
          .pipe(E.timeout(MOCK_TIMEOUT));

        const message = yield* awaitMessage.pipe(E.timeout(MOCK_TIMEOUT));

        expect(message).toBe("hello");

        yield* closeWebSocket(websocket).pipe(E.timeout(MOCK_TIMEOUT));

        yield* waitForClientCount({
          clientCount: 0,
          webSocketBroadcaster,
        }).pipe(E.timeout(MOCK_TIMEOUT));

        expect(yield* webSocketBroadcaster.clientCount).toBe(0);
      }).pipe(E.provide(ApiServerTest)),
    );

    await runTest(program);
  });
});
