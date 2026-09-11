import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import {
  API_CONNECTION_STATE,
  type ApiConnectionState,
} from "@/electron/renderer/api/common.ts";
import {
  makeTrackingEventStream,
  type TrackingEventStreamEvent,
} from "@/electron/renderer/api/tracking/tracking-event-stream.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

export type TrackingEventStoreSnapshot = {
  readonly connectionState: ApiConnectionState;
  readonly trackingStatus: TrackingApiStatus | null;
};

export type TrackingEventStore = {
  readonly getSnapshot: () => TrackingEventStoreSnapshot;
  readonly start: () => void;
  readonly stop: () => void;
  readonly subscribe: (listener: Listener) => () => void;
};

type Listener = () => void;

const initialSnapshot: TrackingEventStoreSnapshot = {
  connectionState: API_CONNECTION_STATE.DISCONNECTED,
  trackingStatus: null,
};

export function makeTrackingEventStore(): TrackingEventStore {
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
      snapshot: TrackingEventStoreSnapshot,
    ) => TrackingEventStoreSnapshot,
  ): E.Effect<void> {
    return E.sync(() => {
      snapshot = update(snapshot);

      emit();
    });
  }

  const handleTrackingEvent = Match.type<TrackingEventStreamEvent>().pipe(
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
          trackingStatus: event.message.status,
        };
      });
    }),
    Match.exhaustive,
  );

  function start(): void {
    if (fiber !== undefined) {
      return;
    }

    const program = makeTrackingEventStream().pipe(
      Stream.runForEach(handleTrackingEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("Tracking event stream failed.", {
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

    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): TrackingEventStoreSnapshot {
    return snapshot;
  }

  return {
    getSnapshot,
    start,
    stop,
    subscribe,
  };
}

export const trackingEventStore = makeTrackingEventStore();
