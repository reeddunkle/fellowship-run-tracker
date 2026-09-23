import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import * as PersistedQueue from "effect/unstable/persistence/PersistedQueue";
import { describe, expect, test } from "vitest";

import { KeyValueStorePersistedQueueStoreLayer } from "@frt/api/services/persistence/key-value-store-persisted-queue-store.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const QUEUE_NAME = "test-queue";
const EMPTY_TIMEOUT = "50 millis";

const TestItemSchema = Schema.Struct({
  value: Schema.String,
});

type TestItem = typeof TestItemSchema.Type;

type TestQueue = PersistedQueue.PersistedQueue<TestItem>;

class HandlerError extends Schema.TaggedError<HandlerError>()(
  "HandlerError",
  {},
) {
  override get message() {
    return "The test handler failed.";
  }
}

function withQueue<A, Error>(
  keyValueStore: KeyValueStore.KeyValueStore,
  program: (queue: TestQueue) => E.Effect<A, Error>,
) {
  return E.gen(function* () {
    const queue = yield* PersistedQueue.make({
      name: QUEUE_NAME,
      schema: TestItemSchema,
    });

    return yield* program(queue);
  }).pipe(
    E.provide(
      PersistedQueue.layer.pipe(
        Layer.provide(KeyValueStorePersistedQueueStoreLayer),
        Layer.provide(
          Layer.succeed(KeyValueStore.KeyValueStore, keyValueStore),
        ),
      ),
    ),
  );
}

function runWithKeyValueStore<A, Error>(
  program: (keyValueStore: KeyValueStore.KeyValueStore) => E.Effect<A, Error>,
) {
  return E.gen(function* () {
    const keyValueStore = yield* KeyValueStore.KeyValueStore;

    return yield* program(keyValueStore);
  }).pipe(E.provide(KeyValueStore.layerMemory), runTest);
}

function takeOption(queue: TestQueue, options?: { maxAttempts?: number }) {
  return queue
    .take((item, metadata) => {
      return E.succeed({ attempts: metadata.attempts, item });
    }, options)
    .pipe(E.timeoutOption(EMPTY_TIMEOUT));
}

function takeAndFail(queue: TestQueue, options?: { maxAttempts?: number }) {
  return queue
    .take(() => {
      return E.fail(new HandlerError());
    }, options)
    .pipe(E.flip);
}

function readStoredItems(keyValueStore: KeyValueStore.KeyValueStore) {
  return keyValueStore.get(`queue/${QUEUE_NAME}`).pipe(
    E.map((document) => {
      return document === undefined ? [] : JSON.parse(document).items;
    }),
  );
}

describe("KeyValueStorePersistedQueueStore", () => {
  test("removes an item once it's handled", async () => {
    const { first, second, stored } = await runWithKeyValueStore(
      (keyValueStore) => {
        return withQueue(keyValueStore, (queue) => {
          return E.gen(function* () {
            yield* queue.offer({ value: "a" });

            const firstTake = yield* takeOption(queue);
            const secondTake = yield* takeOption(queue);
            const storedItems = yield* readStoredItems(keyValueStore);

            return {
              first: firstTake,
              second: secondTake,
              stored: storedItems,
            };
          });
        });
      },
    );

    expect(first).toEqual(Option.some({ attempts: 0, item: { value: "a" } }));
    expect(second).toEqual(Option.none());
    expect(stored).toEqual([]);
  });

  test("requeues a failed item with one more attempt", async () => {
    const retried = await runWithKeyValueStore((keyValueStore) => {
      return withQueue(keyValueStore, (queue) => {
        return E.gen(function* () {
          yield* queue.offer({ value: "a" });
          yield* takeAndFail(queue);

          return yield* takeOption(queue);
        });
      });
    });

    expect(retried).toEqual(Option.some({ attempts: 1, item: { value: "a" } }));
  });

  test("drops an item once it reaches maxAttempts", async () => {
    const { next, stored } = await runWithKeyValueStore((keyValueStore) => {
      return withQueue(keyValueStore, (queue) => {
        return E.gen(function* () {
          yield* queue.offer({ value: "a" });
          yield* takeAndFail(queue, { maxAttempts: 2 });
          yield* takeAndFail(queue, { maxAttempts: 2 });

          const nextTake = yield* takeOption(queue, { maxAttempts: 2 });
          const storedItems = yield* readStoredItems(keyValueStore);

          return { next: nextTake, stored: storedItems };
        });
      });
    });

    expect(next).toEqual(Option.none());
    expect(stored).toEqual([]);
  });

  test("takes an id again when it's offered after being dropped", async () => {
    const retried = await runWithKeyValueStore((keyValueStore) => {
      return withQueue(keyValueStore, (queue) => {
        return E.gen(function* () {
          yield* queue.offer({ value: "a" }, { id: "job-1" });
          yield* takeAndFail(queue, { maxAttempts: 1 });
          yield* queue.offer({ value: "a" }, { id: "job-1" });

          return yield* takeOption(queue, { maxAttempts: 1 });
        });
      });
    });

    expect(retried).toEqual(Option.some({ attempts: 0, item: { value: "a" } }));
  });

  test("releases an interrupted item without counting an attempt", async () => {
    const retried = await runWithKeyValueStore((keyValueStore) => {
      return withQueue(keyValueStore, (queue) => {
        return E.gen(function* () {
          yield* queue.offer({ value: "a" });

          const handlerStarted = yield* Deferred.make<void>();

          const fiber = yield* queue
            .take(() => {
              return Deferred.succeed(handlerStarted, undefined).pipe(
                E.andThen(E.never),
              );
            })
            .pipe(E.forkChild);

          yield* Deferred.await(handlerStarted);
          yield* Fiber.interrupt(fiber);

          return yield* takeOption(queue);
        });
      });
    });

    expect(retried).toEqual(Option.some({ attempts: 0, item: { value: "a" } }));
  });

  test("ignores an offer with an id that's already queued", async () => {
    const stored = await runWithKeyValueStore((keyValueStore) => {
      return withQueue(keyValueStore, (queue) => {
        return E.gen(function* () {
          yield* queue.offer({ value: "a" }, { id: "job-1" });
          yield* queue.offer({ value: "b" }, { id: "job-1" });

          return yield* readStoredItems(keyValueStore);
        });
      });
    });

    expect(stored).toMatchObject([{ element: { value: "a" }, id: "job-1" }]);
  });

  test("keeps queued items and attempts across restarts", async () => {
    const afterRestart = await runWithKeyValueStore((keyValueStore) => {
      return E.gen(function* () {
        yield* withQueue(keyValueStore, (queue) => {
          return E.gen(function* () {
            yield* queue.offer({ value: "a" });
            yield* takeAndFail(queue);
          });
        });

        return yield* withQueue(keyValueStore, takeOption);
      });
    });

    expect(afterRestart).toEqual(
      Option.some({ attempts: 1, item: { value: "a" } }),
    );
  });
});
