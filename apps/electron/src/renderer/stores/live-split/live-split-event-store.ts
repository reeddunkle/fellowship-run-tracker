import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

import { type LiveSplitApiStatus } from "@frt/shared/live-split/live-split-api-schema.ts";

import {
  type LiveSplitEventStreamError,
  type LiveSplitEventStreamEvent,
  makeLiveSplitEventStream,
} from "@/renderer/api/live-split/live-split-event-stream.ts";
import {
  type ApiEventStore,
  type ApiEventStoreSnapshot,
  makeApiEventStore,
} from "@/renderer/stores/make-api-event-store.ts";

type LiveSplitEventState = {
  readonly serverStatus: LiveSplitApiStatus | null;
};

export type LiveSplitEventStoreSnapshot =
  ApiEventStoreSnapshot<LiveSplitEventState>;

type LiveSplitEventStreamFactory = () => Stream.Stream<
  LiveSplitEventStreamEvent,
  LiveSplitEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeLiveSplitEventStoreOptions = {
  readonly makeEventStream?: LiveSplitEventStreamFactory;
};

export type LiveSplitEventStore = ApiEventStore<LiveSplitEventStoreSnapshot>;

const initialState: LiveSplitEventState = {
  serverStatus: null,
};

export function makeLiveSplitEventStore({
  makeEventStream = makeLiveSplitEventStream,
}: MakeLiveSplitEventStoreOptions = {}): LiveSplitEventStore {
  return makeApiEventStore({
    initialState,
    label: "LiveSplit",
    lifecycle: "while-subscribed",
    makeEventStream,
    reduce: (state, message) => {
      return {
        ...state,
        serverStatus: message.status,
      };
    },
  });
}

export const liveSplitEventStore = makeLiveSplitEventStore();
