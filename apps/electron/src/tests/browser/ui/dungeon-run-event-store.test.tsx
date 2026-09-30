import { QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@frt/api/tests/common/fixtures/dungeon-run-api-fixtures.ts";

import { DungeonRunEventMessageDecodeError } from "@/errors/dungeon-run-event-message-error.ts";
import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { makeDungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";

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

  test("invalidates dungeon run history when the run transitions away from ACTIVE", async () => {
    const activeEvent = {
      message: MOCK_DUNGEON_RUN_API_MESSAGE,
      type: "MESSAGE_RECEIVED",
    } satisfies DungeonRunEventStreamEvent;

    const finishedEvent = {
      message: {
        ...MOCK_DUNGEON_RUN_API_MESSAGE,
        state: {
          ...MOCK_DUNGEON_RUN_STATE_API,
          dungeonRun: {
            ...MOCK_DUNGEON_RUN_STATE_API.dungeonRun,
            status: "COMPLETED",
          },
        },
      },
      type: "MESSAGE_RECEIVED",
    } satisfies DungeonRunEventStreamEvent;

    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(activeEvent, finishedEvent);
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledOnce();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
    });
    expect(store.getSnapshot().runState?.dungeonRun?.status).toBe("COMPLETED");
  });

  test("does not invalidate dungeon run history when the run becomes active for the first time", async () => {
    const activeEvent = {
      message: MOCK_DUNGEON_RUN_API_MESSAGE,
      type: "MESSAGE_RECEIVED",
    } satisfies DungeonRunEventStreamEvent;

    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(activeEvent);
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot().runState).toEqual(MOCK_DUNGEON_RUN_STATE_API);
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
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

  test("stops the restarted event stream after a quick stop and restart", async () => {
    let endedStreamCount = 0;

    const makeEventStream = vi.fn(() => {
      return Stream.never.pipe(
        Stream.ensuring(
          E.sleep("5 millis").pipe(
            E.andThen(
              E.sync(() => {
                endedStreamCount += 1;
              }),
            ),
          ),
        ),
      );
    });

    const store = makeDungeonRunEventStore({
      makeEventStream,
    });

    store.start();
    store.stop();
    store.start();

    await vi.waitFor(() => {
      expect(endedStreamCount).toBe(1);
    });

    await E.runPromise(E.sleep("1 millis"));

    store.stop();

    await vi.waitFor(() => {
      expect(endedStreamCount).toBe(2);
    });
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
