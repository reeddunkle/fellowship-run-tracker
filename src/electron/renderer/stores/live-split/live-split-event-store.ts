import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import {
  API_CONNECTION_STATE,
  type ApiConnectionState,
} from "@/electron/renderer/api/common.ts";
import {
  type LiveSplitEventStreamEvent,
  makeLiveSplitEventStream,
} from "@/electron/renderer/api/live-split/live-split-event-stream.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { type LiveSplitApiStatus } from "@/services/api/live-split/live-split-api-schema.ts";
export type LiveSplitEventStoreSnapshot = {
  readonly connectionState: ApiConnectionState;
  readonly liveSplitStatus: LiveSplitApiStatus | null;
};

type Listener = () => void;

const initialSnapshot: LiveSplitEventStoreSnapshot = {
  connectionState: API_CONNECTION_STATE.DISCONNECTED,
  liveSplitStatus: null,
};

export function makeLiveSplitEventStore() {
  let snapshot = initialSnapshot;
  let fiber: Fiber.Fiber<void, unknown> | undefined;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function updateSnapshot(
    update: (
      snapshot: LiveSplitEventStoreSnapshot,
    ) => LiveSplitEventStoreSnapshot,
  ): E.Effect<void> {
    return E.sync(() => {
      snapshot = update(snapshot);

      emit();
    });
  }

  const handleLiveSplitEvent = Match.type<LiveSplitEventStreamEvent>().pipe(
    Match.when({ type: "CONNECTION_STATE_CHANGED" }, (event) => {
      return updateSnapshot((currentSnapshot) => {
        return {
          ...currentSnapshot,
          connectionState: event.state,
        };
      });
    }),
    Match.when({ type: "MESSAGE_RECEIVED" }, (event) => {
      return updateSnapshot((currentSnapshot) => {
        return {
          ...currentSnapshot,
          liveSplitStatus: event.message.status,
        };
      });
    }),
    Match.exhaustive,
  );

  function start(): void {
    if (fiber !== undefined) {
      return;
    }

    const program = makeLiveSplitEventStream().pipe(
      Stream.runForEach(handleLiveSplitEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("LiveSplit event stream failed.", {
            error,
          });

          yield* updateSnapshot((currentSnapshot) => {
            return {
              ...currentSnapshot,
              connectionState: API_CONNECTION_STATE.DISCONNECTED,
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

    if (listeners.size === 1) {
      start();
    }

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        stop();
      }
    };
  }

  function getSnapshot(): LiveSplitEventStoreSnapshot {
    return snapshot;
  }

  return {
    getSnapshot,
    subscribe,
  };
}

export const liveSplitEventStore = makeLiveSplitEventStore();
