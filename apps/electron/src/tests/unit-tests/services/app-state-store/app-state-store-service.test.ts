import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import { describe, expect, test } from "vitest";

import { runTest } from "@frt/api/tests/common/run-test.ts";

import { makeAppStateStore } from "@/services/app-state-store/app-state-store-service.ts";

describe("AppStateStore", () => {
  test("preserves concurrent updates to different fields", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const store = yield* makeAppStateStore;

        yield* E.all([store.setTheme("light"), store.setSidebarOpen(false)], {
          concurrency: "unbounded",
        });

        expect(yield* store.getSidebarOpen).toBe(false);
        expect(yield* store.getTheme).toBe("light");
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("keeps the latest value when a batch updates one field repeatedly", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const store = yield* makeAppStateStore;

        yield* E.all([store.setTheme("light"), store.setTheme("system")], {
          concurrency: "unbounded",
        });

        expect(yield* store.getTheme).toBe("system");
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("backs up invalid persisted data before resetting it", async () => {
    const invalidPersistedState = "not valid json";
    const program = E.scoped(
      E.gen(function* () {
        const keyValueStore = yield* KeyValueStore.KeyValueStore;
        yield* keyValueStore.set("app-state", invalidPersistedState);

        const store = yield* makeAppStateStore;

        expect(yield* store.getTheme).toBe("dark");
        expect(yield* keyValueStore.get("app-state-corrupt-backup")).toBe(
          invalidPersistedState,
        );
        expect(yield* keyValueStore.get("app-state")).not.toBe(
          invalidPersistedState,
        );
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("leaves invalid persisted data untouched when its backup fails", async () => {
    const invalidPersistedState = "not valid json";
    const program = E.scoped(
      E.gen(function* () {
        const keyValueStore = yield* KeyValueStore.KeyValueStore;
        yield* keyValueStore.set("app-state", invalidPersistedState);

        const failingKeyValueStore = {
          ...keyValueStore,
          set: (key: string, value: string | Uint8Array) => {
            if (key === "app-state-corrupt-backup") {
              return E.fail(
                new KeyValueStore.KeyValueStoreError({
                  key,
                  message: "Backup failed",
                  method: "set",
                }),
              );
            }

            return keyValueStore.set(key, value);
          },
        } satisfies KeyValueStore.KeyValueStore;
        const store = yield* makeAppStateStore.pipe(
          E.provideService(KeyValueStore.KeyValueStore, failingKeyValueStore),
        );
        const result = yield* E.result(store.getTheme);

        expect(Result.isFailure(result)).toBe(true);
        expect(yield* keyValueStore.get("app-state")).toBe(
          invalidPersistedState,
        );
        expect(
          yield* keyValueStore.get("app-state-corrupt-backup"),
        ).toBeUndefined();
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("reports one failed batch write to every queued update", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const keyValueStore = yield* KeyValueStore.KeyValueStore;
        const failingKeyValueStore = {
          ...keyValueStore,
          set: (key: string, value: string | Uint8Array) => {
            if (key === "app-state") {
              return E.fail(
                new KeyValueStore.KeyValueStoreError({
                  key,
                  message: "Write failed",
                  method: "set",
                }),
              );
            }

            return keyValueStore.set(key, value);
          },
        } satisfies KeyValueStore.KeyValueStore;
        const store = yield* makeAppStateStore.pipe(
          E.provideService(KeyValueStore.KeyValueStore, failingKeyValueStore),
        );
        const results = yield* E.all(
          [
            E.result(store.setTheme("light")),
            E.result(store.setSidebarOpen(false)),
          ],
          { concurrency: "unbounded" },
        );

        expect(results.every(Result.isFailure)).toBe(true);
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });
  test("finishes an in-progress write and saves queued updates when the store shuts down", async () => {
    const program = E.gen(function* () {
      const keyValueStore = yield* KeyValueStore.KeyValueStore;

      const slowKeyValueStore = {
        ...keyValueStore,
        set: (key: string, value: string | Uint8Array) => {
          return E.sleep("30 millis").pipe(
            E.andThen(keyValueStore.set(key, value)),
          );
        },
      } satisfies KeyValueStore.KeyValueStore;

      yield* E.scoped(
        E.gen(function* () {
          const store = yield* makeAppStateStore.pipe(
            E.provideService(KeyValueStore.KeyValueStore, slowKeyValueStore),
          );

          yield* store.setTheme("light").pipe(E.forkChild);

          yield* E.sleep("10 millis");

          yield* store.setSidebarOpen(false).pipe(E.forkChild);

          yield* E.sleep("5 millis");
        }),
      );

      return yield* E.scoped(
        E.gen(function* () {
          const store = yield* makeAppStateStore;

          return {
            sidebarOpen: yield* store.getSidebarOpen,
            theme: yield* store.getTheme,
          };
        }),
      );
    }).pipe(E.provide(KeyValueStore.layerMemory));

    expect(await runTest(program)).toEqual({
      sidebarOpen: false,
      theme: "light",
    });
  });

  test("rejects updates offered while shutdown is saving queued updates", async () => {
    const program = E.gen(function* () {
      const keyValueStore = yield* KeyValueStore.KeyValueStore;
      const writeStarts = yield* Queue.unbounded<number>();
      const firstWriteRelease = yield* Deferred.make<void>();
      const secondWriteRelease = yield* Deferred.make<void>();
      const writeReleases = [firstWriteRelease, secondWriteRelease];

      let writeCount = 0;

      const gatedKeyValueStore = {
        ...keyValueStore,
        set: (key: string, value: string | Uint8Array) => {
          return E.suspend(() => {
            const writeIndex = writeCount;

            writeCount += 1;

            const writeRelease = writeReleases[writeIndex];

            return Queue.offer(writeStarts, writeIndex).pipe(
              E.andThen(
                writeRelease === undefined
                  ? E.void
                  : Deferred.await(writeRelease),
              ),
              E.andThen(keyValueStore.set(key, value)),
            );
          });
        },
      } satisfies KeyValueStore.KeyValueStore;

      const scope = yield* Scope.make();

      const store = yield* makeAppStateStore.pipe(
        Scope.provide(scope),
        E.provideService(KeyValueStore.KeyValueStore, gatedKeyValueStore),
      );

      const themeUpdate = yield* store.setTheme("light").pipe(E.forkChild);

      yield* Queue.take(writeStarts);

      const sidebarUpdate = yield* store
        .setSidebarOpen(false)
        .pipe(E.forkChild);

      yield* E.sleep("10 millis");

      const scopeClose = yield* Scope.close(scope, Exit.void).pipe(E.forkChild);

      yield* E.sleep("10 millis");

      yield* Deferred.succeed(firstWriteRelease, undefined);

      yield* Queue.take(writeStarts);

      const lateUpdate = yield* E.result(
        store.setSelectedConfigurationId(null),
      ).pipe(E.timeoutOption("1 second"));

      yield* Deferred.succeed(secondWriteRelease, undefined);

      yield* Fiber.join(scopeClose);
      yield* Fiber.join(themeUpdate);
      yield* Fiber.join(sidebarUpdate);

      return lateUpdate.pipe(
        Option.map(
          Result.match({
            onFailure: (error) => error._tag,
            onSuccess: () => "Succeeded",
          }),
        ),
      );
    }).pipe(E.provide(KeyValueStore.layerMemory));

    expect(await runTest(program)).toEqual(
      Option.some("AppStateStoreClosedError"),
    );
  });

  test("rejects updates after the store has shut down", async () => {
    const program = E.gen(function* () {
      const store = yield* E.scoped(makeAppStateStore);

      return yield* E.result(store.setTheme("light")).pipe(
        E.timeoutOption("1 second"),
      );
    }).pipe(E.provide(KeyValueStore.layerMemory));

    const result = await runTest(program);

    expect(
      result.pipe(
        Option.map(
          Result.match({
            onFailure: (error) => error._tag,
            onSuccess: () => "Succeeded",
          }),
        ),
      ),
    ).toEqual(Option.some("AppStateStoreClosedError"));
  });
});
