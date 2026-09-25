import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { runTest } from "@frt/api/tests/common/run-test.ts";
import { makeConnectionManager } from "@frt/api/util/connection-manager/make-connection-manager.ts";

type TestConnection = {
  readonly id: number;
  readonly unavailable: Deferred.Deferred<void>;
};

function makeTestConnectionManager() {
  return E.gen(function* () {
    const acquiredCount = yield* Ref.make(0);
    const releasedCount = yield* Ref.make(0);

    const connectionManager = yield* makeConnectionManager({
      acquire: E.gen(function* () {
        const id = yield* Ref.updateAndGet(acquiredCount, (count) => {
          return count + 1;
        });

        yield* E.addFinalizer(() => {
          return Ref.update(releasedCount, (count) => {
            return count + 1;
          });
        });

        return {
          id,
          unavailable: yield* Deferred.make<void>(),
        } satisfies TestConnection;
      }),
      getUnavailability: (connection) => {
        return Stream.fromEffect(Deferred.await(connection.unavailable));
      },
      name: "Test",
    });

    return {
      connectionManager,
      releasedCount,
    };
  });
}

describe("makeConnectionManager", () => {
  test("starts disconnected with no connection", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { connectionManager } = yield* makeTestConnectionManager();

        expect(yield* connectionManager.status).toEqual({
          _tag: "Disconnected",
        });
        expect(Option.isNone(yield* connectionManager.connection)).toBe(true);
      }),
    );

    await runTest(program);
  });

  test("connect acquires a connection and reports Connected", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { connectionManager } = yield* makeTestConnectionManager();

        yield* connectionManager.connect();

        const connection = yield* connectionManager.connection;

        expect(yield* connectionManager.status).toEqual({ _tag: "Connected" });
        expect(Option.map(connection, ({ id }) => id)).toEqual(Option.some(1));
      }),
    );

    await runTest(program);
  });

  test("reports Disconnected when the connection becomes unavailable", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { connectionManager } = yield* makeTestConnectionManager();

        yield* connectionManager.connect();

        const connection = Option.getOrThrow(
          yield* connectionManager.connection,
        );

        yield* Deferred.succeed(connection.unavailable, undefined);

        const status = yield* connectionManager.statusChanges.pipe(
          Stream.takeUntil((change) => {
            return change._tag === "Disconnected";
          }),
          Stream.runLast,
        );

        expect(status).toEqual(Option.some({ _tag: "Disconnected" }));
      }),
    );

    await runTest(program);
  });

  test("disconnect releases the connection", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { connectionManager, releasedCount } =
          yield* makeTestConnectionManager();

        yield* connectionManager.connect();
        yield* connectionManager.disconnect();

        expect(yield* connectionManager.status).toEqual({
          _tag: "Disconnected",
        });
        expect(Option.isNone(yield* connectionManager.connection)).toBe(true);
        expect(yield* Ref.get(releasedCount)).toBe(1);
      }),
    );

    await runTest(program);
  });

  test("reconnecting replaces the previous connection", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const { connectionManager, releasedCount } =
          yield* makeTestConnectionManager();

        yield* connectionManager.connect();
        yield* connectionManager.connect();

        const connection = yield* connectionManager.connection;

        expect(Option.map(connection, ({ id }) => id)).toEqual(Option.some(2));
        expect(yield* Ref.get(releasedCount)).toBe(1);
      }),
    );

    await runTest(program);
  });

  test("an acquire failure surfaces the error and stays Disconnected", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const connectionManager = yield* makeConnectionManager({
          acquire: E.fail("acquire failed" as const),
          getUnavailability: () => {
            return Stream.empty;
          },
          name: "Test",
        });

        const error = yield* connectionManager.connect().pipe(E.flip);

        expect(error).toBe("acquire failed");
        expect(yield* connectionManager.status).toEqual({
          _tag: "Disconnected",
        });
        expect(Option.isNone(yield* connectionManager.connection)).toBe(true);
      }),
    );

    await runTest(program);
  });
});
