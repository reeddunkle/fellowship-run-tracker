import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import { API_EVENT_CONNECTION_STATE } from "@/electron/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/electron/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeDungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { DungeonRunEventMessageDecodeError } from "@/errors/dungeon-run-event-stream-error.ts";
import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@/tests/common/fixtures/dungeon-run-api-fixtures.ts";

describe("DungeonRunEventStore", () => {
  test("starts with a disconnected empty snapshot", () => {
    const store = makeDungeonRunEventStore();

    expect(store.getSnapshot()).toEqual({
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      runState: null,
    });
  });

  test("updates event connection state from the event stream", async () => {
    const event = {
      state: API_EVENT_CONNECTION_STATE.CONNECTED,
      type: "CONNECTION_STATE_CHANGED",
    } satisfies DungeonRunEventStreamEvent;

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(event);
      },
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.CONNECTED,
        runState: null,
      });
    });
  });

  test("updates dungeon run state from the event stream", async () => {
    const event = {
      message: MOCK_DUNGEON_RUN_API_MESSAGE,
      type: "MESSAGE_RECEIVED",
    } satisfies DungeonRunEventStreamEvent;

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(event);
      },
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
        runState: MOCK_DUNGEON_RUN_STATE_API,
      });
    });
  });

  test("sets the event connection state to error when the event stream fails", async () => {
    const error = new DungeonRunEventMessageDecodeError({
      cause: new Error("Event stream failed."),
    });

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.fail(error);
      },
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        eventConnectionState: API_EVENT_CONNECTION_STATE.ERROR,
        runState: null,
      });
    });
  });

  test("notifies subscribers when the snapshot changes", async () => {
    const event = {
      state: API_EVENT_CONNECTION_STATE.CONNECTING,
      type: "CONNECTION_STATE_CHANGED",
    } satisfies DungeonRunEventStreamEvent;

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(event);
      },
    });

    const listener = vi.fn();

    store.subscribe(listener);
    store.start();

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledOnce();
    });

    expect(store.getSnapshot().eventConnectionState).toBe(
      API_EVENT_CONNECTION_STATE.CONNECTING,
    );
  });

  test("does not notify a subscriber after it unsubscribes", async () => {
    const event = {
      state: API_EVENT_CONNECTION_STATE.CONNECTED,
      type: "CONNECTION_STATE_CHANGED",
    } satisfies DungeonRunEventStreamEvent;

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(event);
      },
    });

    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot().eventConnectionState).toBe(
        API_EVENT_CONNECTION_STATE.CONNECTED,
      );
    });

    expect(listener).not.toHaveBeenCalled();
  });

  test("does not start another event stream while already running", () => {
    const makeEventStream = vi.fn(() => {
      return Stream.never;
    });

    const store = makeDungeonRunEventStore({
      makeEventStream,
    });

    store.start();
    store.start();

    expect(makeEventStream).toHaveBeenCalledOnce();

    store.stop();
  });

  test("can be started again after being stopped", () => {
    const makeEventStream = vi.fn(() => {
      return Stream.never;
    });

    const store = makeDungeonRunEventStore({
      makeEventStream,
    });

    store.start();
    store.stop();
    store.start();

    expect(makeEventStream).toHaveBeenCalledTimes(2);

    store.stop();
  });
});
