import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const MOCK_TIMEOUT = "1 second";

function collectMessages(messages: Stream.Stream<string>, count: number) {
  return messages.pipe(
    Stream.take(count),
    Stream.runCollect,
    E.map((collectedMessages) => {
      return Array.from(collectedMessages);
    }),
    E.timeout(MOCK_TIMEOUT),
  );
}

describe("DungeonRunWebSocketBroadcaster", () => {
  test("replays the latest published message to a new subscriber", async () => {
    const program = E.gen(function* () {
      const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;

      yield* webSocketBroadcaster.publish("first");
      yield* webSocketBroadcaster.publish("second");

      const messages = yield* collectMessages(webSocketBroadcaster.messages, 1);

      expect(messages).toEqual(["second"]);
    }).pipe(E.provide(DungeonRunWebSocketBroadcaster.layer));

    await runTest(program);
  });

  test("delivers messages published after subscribing", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const webSocketBroadcaster = yield* DungeonRunWebSocketBroadcaster;
        const receivedFirst = yield* Deferred.make<void>();

        yield* webSocketBroadcaster.publish("first");

        const subscriberFiber = yield* collectMessages(
          webSocketBroadcaster.messages.pipe(
            Stream.tap(() => {
              return Deferred.succeed(receivedFirst, undefined);
            }),
          ),
          2,
        ).pipe(E.forkScoped);

        yield* Deferred.await(receivedFirst).pipe(E.timeout(MOCK_TIMEOUT));

        yield* webSocketBroadcaster.publish("second");

        expect(yield* Fiber.join(subscriberFiber)).toEqual(["first", "second"]);
      }).pipe(E.provide(DungeonRunWebSocketBroadcaster.layer)),
    );

    await runTest(program);
  });
});
