import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { describe, expect, test } from "vitest";

import { ApiServerTest } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const MOCK_TIMEOUT = "1 second";

class WebSocketOpenError extends Data.TaggedError("WebSocketOpenError") {
  override get message() {
    return "The WebSocket failed to open.";
  }
}

function connectWebSocket(url: string): E.Effect<void, WebSocketOpenError> {
  return E.callback<void, WebSocketOpenError>((resume) => {
    const websocket = new WebSocket(url);

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

function getWebSocketUrl(httpServer: HttpServer.HttpServer["Service"]): string {
  return `${HttpServer.formatAddress(httpServer.address)
    .replace(/^http:/, "ws:")
    .replace("0.0.0.0", "127.0.0.1")}${ROUTES.dungeonRunEvents}`;
}

describe("WebSocket client shutdown", () => {
  test("closes connected WebSocket clients before the server waits for its connections", async () => {
    const shutdownMilliseconds = await E.gen(function* () {
      const scope = yield* Scope.make();
      const context = yield* Layer.buildWithScope(ApiServerTest, scope);
      const httpServer = Context.get(context, HttpServer.HttpServer);

      yield* connectWebSocket(getWebSocketUrl(httpServer)).pipe(
        E.timeout(MOCK_TIMEOUT),
      );

      const [shutdownDuration] = yield* Scope.close(scope, Exit.void).pipe(
        E.timed,
      );

      return Duration.toMillis(shutdownDuration);
    }).pipe(runTest);

    expect(shutdownMilliseconds).toBeLessThan(1_000);
  });
});
