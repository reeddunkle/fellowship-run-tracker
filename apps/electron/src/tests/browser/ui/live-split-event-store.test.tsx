import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type LiveSplitEventStreamEvent } from "@/renderer/api/live-split/live-split-event-stream.ts";
import { makeLiveSplitEventStore } from "@/renderer/stores/live-split/live-split-event-store.ts";

const CONNECTED_EVENT = {
  message: {
    status: {
      status: "Connected",
    },
    version: 1,
  },
  type: "MESSAGE_RECEIVED",
} satisfies LiveSplitEventStreamEvent;

describe("LiveSplitEventStore", () => {
  test("starts with a disconnected snapshot and no server status", () => {
    const store = makeLiveSplitEventStore();

    expect(store.getSnapshot()).toEqual({
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      serverStatus: null,
    });
  });

  test("updates server status from the event stream once subscribed", async () => {
    const store = makeLiveSplitEventStore({
      makeEventStream: () => {
        return Stream.make(CONNECTED_EVENT);
      },
    });

    const unsubscribe = store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().serverStatus).toEqual({
        status: "Connected",
      });
    });

    unsubscribe();
  });

  test("opens the event stream only while subscribed", () => {
    const makeEventStream = vi.fn(() => {
      return Stream.never;
    });

    const store = makeLiveSplitEventStore({
      makeEventStream,
    });

    expect(makeEventStream).not.toHaveBeenCalled();

    const unsubscribe = store.subscribe(() => {});

    expect(makeEventStream).toHaveBeenCalledOnce();

    unsubscribe();
  });
});
