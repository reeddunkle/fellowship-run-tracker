import * as E from "effect/Effect";
import * as HttpServer from "effect/http/HttpServer";
import { describe, expect, test } from "vitest";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";
import { ApiServerTest } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  getWebSocketUrl,
  makeWebSocketMessageAwaiter,
  openWebSocket,
  waitForWebSocketOpen,
} from "@frt/api/tests/common/websocket-test-client.ts";
import { ROUTES } from "@frt/api-contract/constants/routes.ts";

const MOCK_TIMEOUT = "1 second";

describe("DungeonRunWebSocketBroadcaster integration", () => {
  test("sends the latest published message to a newly connected client", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
      const httpServer = yield* HttpServer.HttpServer;

      yield* webSocketBroadcaster.publish("first");
      yield* webSocketBroadcaster.publish("latest");

      const websocket = yield* openWebSocket(
        getWebSocketUrl({ httpServer, route: ROUTES.dungeonRunEvents }),
      );

      const awaitMessage = yield* makeWebSocketMessageAwaiter(websocket);

      yield* waitForWebSocketOpen(websocket).pipe(E.timeout(MOCK_TIMEOUT));

      const message = yield* awaitMessage.pipe(E.timeout(MOCK_TIMEOUT));

      expect(message).toBe("latest");
    }).pipe(E.scoped, E.provide(ApiServerTest));

    await runTest(program);
  });

  test("sends messages published after a client connects", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
      const httpServer = yield* HttpServer.HttpServer;

      const websocket = yield* openWebSocket(
        getWebSocketUrl({ httpServer, route: ROUTES.dungeonRunEvents }),
      );

      yield* waitForWebSocketOpen(websocket).pipe(E.timeout(MOCK_TIMEOUT));

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
    }).pipe(E.scoped, E.provide(ApiServerTest));

    await runTest(program);
  });
});
