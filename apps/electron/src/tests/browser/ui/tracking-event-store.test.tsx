import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type TrackingEventStreamEvent } from "@/renderer/api/tracking/tracking-event-stream.ts";
import { makeTrackingEventStore } from "@/renderer/stores/tracking/tracking-event-store.ts";

const IDLE_EVENT = {
  message: {
    status: {
      status: "Idle",
    },
    version: 1,
  },
  type: "MESSAGE_RECEIVED",
} satisfies TrackingEventStreamEvent;

describe("TrackingEventStore", () => {
  test("starts with a disconnected snapshot and no tracking status", () => {
    const store = makeTrackingEventStore();

    expect(store.getSnapshot()).toEqual({
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      trackingStatus: null,
    });
  });

  test("updates tracking status from the event stream", async () => {
    const store = makeTrackingEventStore({
      makeEventStream: () => {
        return Stream.make(IDLE_EVENT);
      },
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot().trackingStatus).toEqual({
        status: "Idle",
      });
    });
  });

  test("waits for start before opening the event stream", () => {
    const makeEventStream = vi.fn(() => {
      return Stream.never;
    });

    const store = makeTrackingEventStore({
      makeEventStream,
    });

    store.subscribe(() => {});

    expect(makeEventStream).not.toHaveBeenCalled();

    store.start();

    expect(makeEventStream).toHaveBeenCalledOnce();

    store.stop();
  });
});
