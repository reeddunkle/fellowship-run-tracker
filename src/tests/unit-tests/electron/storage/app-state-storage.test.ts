import * as E from "effect/Effect";
import * as Result from "effect/Result";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { describe, expect, test } from "vitest";

import { makeAppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { runTest } from "@/tests/common/run-test.ts";

describe("AppStateStorage", () => {
  test("preserves concurrent updates to different fields", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const storage = yield* makeAppStateStorage;

        yield* E.all(
          [storage.setTheme("light"), storage.setSidebarOpen(false)],
          { concurrency: "unbounded" },
        );

        expect(yield* storage.getSidebarOpen).toBe(false);
        expect(yield* storage.getTheme).toBe("light");
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("keeps the latest value when a batch updates one field repeatedly", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const storage = yield* makeAppStateStorage;

        yield* E.all([storage.setTheme("light"), storage.setTheme("system")], {
          concurrency: "unbounded",
        });

        expect(yield* storage.getTheme).toBe("system");
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

        const storage = yield* makeAppStateStorage;

        expect(yield* storage.getTheme).toBe("dark");
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
        const storage = yield* makeAppStateStorage.pipe(
          E.provideService(KeyValueStore.KeyValueStore, failingKeyValueStore),
        );
        const result = yield* E.result(storage.getTheme);

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
        const storage = yield* makeAppStateStorage.pipe(
          E.provideService(KeyValueStore.KeyValueStore, failingKeyValueStore),
        );
        const results = yield* E.all(
          [
            E.result(storage.setTheme("light")),
            E.result(storage.setSidebarOpen(false)),
          ],
          { concurrency: "unbounded" },
        );

        expect(results.every(Result.isFailure)).toBe(true);
      }),
    ).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });
});
