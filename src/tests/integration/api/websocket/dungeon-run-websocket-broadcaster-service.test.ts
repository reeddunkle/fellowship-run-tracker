import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Socket from "effect/unstable/socket/Socket";
import { describe, expect, test } from "vitest";

import {
  DungeonRunWebSocketBroadcaster,
  DungeonRunWebSocketBroadcasterLive,
  type WebSocketWriter,
} from "@/services/api/websocket-broadcaster-service.ts";
import { runTest } from "@/tests/common/run-test.ts";

function makeSocketError(): Socket.SocketError {
  return new Socket.SocketError({
    reason: new Socket.SocketWriteError({
      cause: new Error("WebSocket write failed."),
    }),
  });
}

describe("WebSocketBroadcaster", () => {
  test("publishes messages to registered clients", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const messages = yield* Ref.make<ReadonlyArray<string>>([]);

        const writer: WebSocketWriter = (message) => {
          return Ref.update(messages, (currentMessages) => {
            return [...currentMessages, message];
          });
        };

        yield* webSocketBroadcaster.registerClient(writer);

        expect(yield* webSocketBroadcaster.clientCount).toBe(1);

        yield* webSocketBroadcaster.publish("first");
        yield* webSocketBroadcaster.publish("second");

        expect(yield* Ref.get(messages)).toEqual(["first", "second"]);
      }).pipe(E.provide(DungeonRunWebSocketBroadcasterLive)),
    );

    await runTest(program);
  });

  test("removes a failing client and continues publishing to healthy clients", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const healthyMessages = yield* Ref.make<ReadonlyArray<string>>([]);

        const healthyWriter: WebSocketWriter = (message) => {
          return Ref.update(healthyMessages, (currentMessages) => {
            return [...currentMessages, message];
          });
        };

        const failingWriter: WebSocketWriter = () => {
          return E.fail(makeSocketError());
        };

        yield* webSocketBroadcaster.registerClient(healthyWriter);
        yield* webSocketBroadcaster.registerClient(failingWriter);

        expect(yield* webSocketBroadcaster.clientCount).toBe(2);

        // The failing client should not cause publish itself to fail.
        yield* webSocketBroadcaster.publish("first");

        expect(yield* Ref.get(healthyMessages)).toEqual(["first"]);

        // A writer that fails is removed from the registered client set.
        expect(yield* webSocketBroadcaster.clientCount).toBe(1);

        /*
         * Subsequent publishes continue normally and no longer attempt to
         * write to the failed client.
         */
        yield* webSocketBroadcaster.publish("second");

        expect(yield* Ref.get(healthyMessages)).toEqual(["first", "second"]);
        expect(yield* webSocketBroadcaster.clientCount).toBe(1);
      }).pipe(E.provide(DungeonRunWebSocketBroadcasterLive)),
    );

    await runTest(program);
  });

  test("sends the latest published message to a client", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const messages = yield* Ref.make<ReadonlyArray<string>>([]);

        yield* webSocketBroadcaster.publish("first");
        yield* webSocketBroadcaster.publish("second");

        const writer: WebSocketWriter = (message) => {
          return Ref.update(messages, (currentMessages) => {
            return [...currentMessages, message];
          });
        };

        yield* webSocketBroadcaster.sendLatestToClient(writer);

        expect(yield* Ref.get(messages)).toEqual(["second"]);
      }).pipe(E.provide(DungeonRunWebSocketBroadcasterLive)),
    );

    await runTest(program);
  });

  test("does nothing when sending the latest message before anything has been published", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const messages = yield* Ref.make<ReadonlyArray<string>>([]);

        const writer: WebSocketWriter = (message) => {
          return Ref.update(messages, (currentMessages) => {
            return [...currentMessages, message];
          });
        };

        yield* webSocketBroadcaster.sendLatestToClient(writer);

        expect(yield* Ref.get(messages)).toEqual([]);
      }).pipe(E.provide(DungeonRunWebSocketBroadcasterLive)),
    );

    await runTest(program);
  });

  test("does not fail when sending the latest message to a failing client", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;

        yield* webSocketBroadcaster.publish("latest");

        const failingWriter: WebSocketWriter = () => {
          return E.fail(makeSocketError());
        };

        /*
         * sendLatestToClient owns the same best-effort policy as publish,
         * so the writer failure must not escape.
         */
        yield* webSocketBroadcaster.sendLatestToClient(failingWriter);
      }).pipe(E.provide(DungeonRunWebSocketBroadcasterLive)),
    );

    await runTest(program);
  });
});
