import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import {
  PersistedQueueError,
  PersistedQueueStore,
} from "effect/unstable/persistence/PersistedQueue";

const QueueItemSchema = Schema.Struct({
  attempts: Schema.Int,
  element: Schema.Json,
  id: Schema.String,
});

type QueueItem = typeof QueueItemSchema.Type;

const QueueDocumentSchema = Schema.Struct({
  items: Schema.Array(QueueItemSchema),
});

type QueueState = {
  items: ReadonlyArray<QueueItem>;
  readonly latch: Latch.Latch;
  readonly takenIds: Set<string>;
};

function getQueueKey(name: string) {
  return `queue/${name}`;
}

function isAvailable(state: QueueState) {
  return (item: QueueItem) => {
    return !state.takenIds.has(item.id);
  };
}

function toPersistedQueueError(message: string) {
  return (cause: unknown) => {
    return new PersistedQueueError({ cause, message });
  };
}

const makeKeyValueStorePersistedQueueStore = E.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore;
  const documents = KeyValueStore.toSchemaStore(
    keyValueStore,
    QueueDocumentSchema,
  );

  const semaphore = yield* Semaphore.make(1);
  const queues = new Map<string, QueueState>();

  const persist = (name: string, state: QueueState) => {
    return documents
      .set(getQueueKey(name), { items: state.items })
      .pipe(E.mapError(toPersistedQueueError("Failed to write the queue.")));
  };

  const getQueue = E.fn("KeyValueStorePersistedQueueStore.getQueue")(function* (
    name: string,
  ) {
    const existing = queues.get(name);

    if (existing !== undefined) {
      return existing;
    }

    const document = yield* documents
      .get(getQueueKey(name))
      .pipe(E.mapError(toPersistedQueueError("Failed to read the queue.")));

    const state: QueueState = {
      items: Option.match(document, {
        onNone: () => {
          return [];
        },
        onSome: ({ items }) => {
          return items;
        },
      }),
      latch: Latch.makeUnsafe(false),
      takenIds: new Set(),
    };

    if (state.items.some(isAvailable(state))) {
      state.latch.openUnsafe();
    }

    queues.set(name, state);

    return state;
  });

  const offer: PersistedQueueStore["Service"]["offer"] = ({
    element,
    id,
    name,
  }) => {
    return semaphore.withPermit(
      E.gen(function* () {
        const state = yield* getQueue(name);

        if (
          state.items.some((item) => {
            return item.id === id;
          })
        ) {
          return;
        }

        const encodedElement = yield* Schema.decodeUnknownEffect(Schema.Json)(
          element,
        ).pipe(
          E.mapError(toPersistedQueueError("Queue elements must be JSON.")),
        );

        state.items = [
          ...state.items,
          { attempts: 0, element: encodedElement, id },
        ];

        yield* persist(name, state);

        state.latch.openUnsafe();
      }),
    );
  };

  const settle = E.fn("KeyValueStorePersistedQueueStore.settle")(function* ({
    exit,
    item,
    maxAttempts,
    name,
    state,
  }: {
    readonly exit: Exit.Exit<unknown, unknown>;
    readonly item: QueueItem;
    readonly maxAttempts: number;
    readonly name: string;
    readonly state: QueueState;
  }) {
    state.takenIds.delete(item.id);

    const isInterruptOnly = !Exit.isSuccess(exit) && Exit.hasInterrupts(exit);

    if (!isInterruptOnly) {
      const attempts = item.attempts + 1;
      const isExhausted = !Exit.isSuccess(exit) && attempts >= maxAttempts;

      state.items =
        Exit.isSuccess(exit) || isExhausted
          ? state.items.filter((candidate) => {
              return candidate.id !== item.id;
            })
          : state.items.map((candidate) => {
              return candidate.id === item.id
                ? { ...candidate, attempts }
                : candidate;
            });

      yield* persist(name, state);

      if (isExhausted) {
        yield* E.logError("Gave up on a persisted queue item.", {
          attempts,
          id: item.id,
          name,
        });
      }
    }

    if (state.items.some(isAvailable(state))) {
      state.latch.openUnsafe();
    }
  });

  const takeAvailableItem = (state: QueueState): E.Effect<QueueItem> => {
    return state.latch.await.pipe(
      E.andThen(
        semaphore.withPermit(
          E.sync(() => {
            const next = A.findFirst(state.items, isAvailable(state));

            if (Option.isNone(next)) {
              state.latch.closeUnsafe();
            } else {
              state.takenIds.add(next.value.id);
            }

            return next;
          }),
        ),
      ),
      E.flatMap(
        Option.match({
          onNone: () => {
            return takeAvailableItem(state);
          },
          onSome: E.succeed,
        }),
      ),
    );
  };

  const take: PersistedQueueStore["Service"]["take"] = ({
    maxAttempts,
    name,
  }) => {
    return E.gen(function* () {
      const state = yield* semaphore.withPermit(getQueue(name));
      const item = yield* takeAvailableItem(state);

      yield* E.addFinalizer((exit) => {
        return semaphore
          .withPermit(settle({ exit, item, maxAttempts, name, state }))
          .pipe(
            E.catch((error) => {
              return E.logError("Failed to settle a persisted queue item.", {
                error,
                id: item.id,
                name,
              });
            }),
          );
      });

      return {
        attempts: item.attempts,
        element: item.element,
        id: item.id,
      };
    });
  };

  return PersistedQueueStore.of({ offer, take });
});

export const KeyValueStorePersistedQueueStoreLayer = Layer.effect(
  PersistedQueueStore,
  makeKeyValueStorePersistedQueueStore,
);
