import { QueryClient } from "@tanstack/react-query";
import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@frt/api/tests/common/fixtures/dungeon-run-api-fixtures.ts";

import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { makeDungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";

const DUNGEON_RUN_HISTORY_QUERY_KEY = [
  ...DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
  "seeded",
];

function makeQueryClientWithDungeonRunHistory() {
  const queryClient = new QueryClient();

  queryClient.setQueryData(DUNGEON_RUN_HISTORY_QUERY_KEY, "seeded history");

  return queryClient;
}

function isDungeonRunHistoryInvalidated(queryClient: QueryClient) {
  return queryClient.getQueryState(DUNGEON_RUN_HISTORY_QUERY_KEY)
    ?.isInvalidated;
}

describe("DungeonRunEventStore", () => {
  test("starts with a disconnected empty snapshot", () => {
    const store = makeDungeonRunEventStore();

    expect(store.getSnapshot()).toEqual({
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      runState: null,
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

    const queryClient = makeQueryClientWithDungeonRunHistory();

    const store = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.make(activeEvent, finishedEvent);
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(isDungeonRunHistoryInvalidated(queryClient)).toBe(true);
    });

    expect(store.getSnapshot().runState?.dungeonRun?.status).toBe("COMPLETED");
  });

  test("does not invalidate dungeon run history when the run becomes active for the first time", async () => {
    const activeEvent = {
      message: MOCK_DUNGEON_RUN_API_MESSAGE,
      type: "MESSAGE_RECEIVED",
    } satisfies DungeonRunEventStreamEvent;

    const queryClient = makeQueryClientWithDungeonRunHistory();

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

    expect(isDungeonRunHistoryInvalidated(queryClient)).toBe(false);
  });
});
