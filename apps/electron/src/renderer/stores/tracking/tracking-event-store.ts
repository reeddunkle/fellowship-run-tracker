import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import {
  makeTrackingEventStream,
  type TrackingEventStreamEvent,
} from "@/renderer/api/tracking/tracking-event-stream.ts";
import { makeRestartableBrowserProgram } from "@/renderer/runtimes/make-restartable-browser-program.ts";

type TrackingEventStoreSnapshot = {
  readonly eventConnectionState: ApiEventConnectionState;
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
  eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
  trackingStatus: null,
};

export function makeTrackingEventStore(): TrackingEventStore {
  let snapshot = initialSnapshot;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function updateSnapshot(
    update: (
      currentSnapshot: TrackingEventStoreSnapshot,
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
          eventConnectionState: event.state,
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

  const { start, stop } = makeRestartableBrowserProgram(() => {
    return makeTrackingEventStream().pipe(
      Stream.runForEach(handleTrackingEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("Tracking event stream failed.", {
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
    );
  });

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
