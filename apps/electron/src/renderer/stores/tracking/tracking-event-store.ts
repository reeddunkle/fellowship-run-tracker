import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";

import {
  makeTrackingEventStream,
  type TrackingEventStreamError,
  type TrackingEventStreamEvent,
} from "@/renderer/api/tracking/tracking-event-stream.ts";
import {
  type ApiEventStoreSnapshot,
  type ManualApiEventStore,
  makeApiEventStore,
} from "@/renderer/stores/make-api-event-store.ts";

type TrackingEventState = {
  readonly trackingStatus: TrackingApiStatus | null;
};

type TrackingEventStoreSnapshot = ApiEventStoreSnapshot<TrackingEventState>;

type TrackingEventStreamFactory = () => Stream.Stream<
  TrackingEventStreamEvent,
  TrackingEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeTrackingEventStoreOptions = {
  readonly makeEventStream?: TrackingEventStreamFactory;
};

export type TrackingEventStore =
  ManualApiEventStore<TrackingEventStoreSnapshot>;

const initialState: TrackingEventState = {
  trackingStatus: null,
};

export function makeTrackingEventStore({
  makeEventStream = makeTrackingEventStream,
}: MakeTrackingEventStoreOptions = {}): TrackingEventStore {
  return makeApiEventStore({
    initialState,
    label: "Tracking",
    lifecycle: "manual",
    makeEventStream,
    reduce: (state, message) => {
      return {
        ...state,
        trackingStatus: message.status,
      };
    },
  });
}

export const trackingEventStore = makeTrackingEventStore();
