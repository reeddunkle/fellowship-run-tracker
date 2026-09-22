import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import type * as Socket from "effect/unstable/socket/Socket";

import { type DungeonRunStateApi } from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import {
  type DungeonRunEventStreamError,
  type DungeonRunEventStreamEvent,
  makeDungeonRunEventStream,
} from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

export type DungeonRunEventStoreSnapshot = {
  readonly eventConnectionState: ApiEventConnectionState;
  readonly runState: DungeonRunStateApi | null;
};

type Listener = () => void;

type DungeonRunEventStreamFactory = () => Stream.Stream<
  DungeonRunEventStreamEvent,
  DungeonRunEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeDungeonRunEventStoreOptions = {
  readonly makeEventStream?: DungeonRunEventStreamFactory;
};

export type DungeonRunEventStore = {
  readonly getSnapshot: () => DungeonRunEventStoreSnapshot;
  readonly onRunFinished: (listener: Listener) => () => void;
  readonly start: () => void;
  readonly stop: () => void;
  readonly subscribe: (listener: Listener) => () => void;
};

const initialSnapshot: DungeonRunEventStoreSnapshot = {
  eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
  runState: null,
};

export function makeDungeonRunEventStore({
  makeEventStream = makeDungeonRunEventStream,
}: MakeDungeonRunEventStoreOptions = {}): DungeonRunEventStore {
  let snapshot = initialSnapshot;
  let fiber: Fiber.Fiber<void, unknown> | undefined;

  const listeners = new Set<Listener>();
  const runFinishedListeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function emitRunFinished(): void {
    runFinishedListeners.forEach((listener) => {
      listener();
    });
  }

  function updateSnapshot(
    update: (
      currentSnapshot: DungeonRunEventStoreSnapshot,
    ) => DungeonRunEventStoreSnapshot,
  ): E.Effect<void> {
    return E.sync(() => {
      snapshot = update(snapshot);

      emit();
    });
  }

  const handleDungeonRunEvent = Match.type<DungeonRunEventStreamEvent>().pipe(
    Match.when({ type: "CONNECTION_STATE_CHANGED" }, (event) => {
      return updateSnapshot((currentSnapshot) => {
        return {
          ...currentSnapshot,
          eventConnectionState: event.state,
        };
      });
    }),
    Match.when({ type: "MESSAGE_RECEIVED" }, (event) => {
      const previousStatus = snapshot.runState?.dungeonRun?.status;
      const nextStatus = event.message.state.dungeonRun?.status;

      return updateSnapshot((currentSnapshot) => {
        return {
          ...currentSnapshot,
          runState: event.message.state,
        };
      }).pipe(
        E.tap(() => {
          return E.sync(() => {
            if (previousStatus === "ACTIVE" && nextStatus !== "ACTIVE") {
              emitRunFinished();
            }
          });
        }),
      );
    }),
    Match.exhaustive,
  );

  function start(): void {
    if (fiber !== undefined) {
      return;
    }

    const program = makeEventStream().pipe(
      Stream.runForEach(handleDungeonRunEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("Dungeon run event stream failed.", {
            error,
          });

          yield* updateSnapshot((currentSnapshot) => {
            return {
              ...currentSnapshot,
              eventConnectionState: API_EVENT_CONNECTION_STATE.ERROR,
            };
          });
        });
      }),
      E.ensuring(
        E.sync(() => {
          fiber = undefined;
        }),
      ),
    );

    fiber = browserRuntime.runFork(program);
  }

  function stop(): void {
    if (fiber === undefined) {
      return;
    }

    fiber.pipe(Fiber.interrupt, E.runFork);

    fiber = undefined;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function onRunFinished(listener: Listener): () => void {
    runFinishedListeners.add(listener);

    return () => {
      runFinishedListeners.delete(listener);
    };
  }

  function getSnapshot(): DungeonRunEventStoreSnapshot {
    return snapshot;
  }

  return {
    getSnapshot,
    onRunFinished,
    start,
    stop,
    subscribe,
  };
}

export const dungeonRunEventStore = makeDungeonRunEventStore();
