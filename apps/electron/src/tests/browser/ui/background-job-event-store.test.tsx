import { QueryClient } from "@tanstack/react-query";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";

import { type BackgroundJobApiSnapshot } from "@frt/shared/background-job/background-job-api-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

import { type BackgroundJobEventStreamEvent } from "@/renderer/api/background-job/background-job-event-stream.ts";
import { getBackgroundJobsQueryOptions } from "@/renderer/api/background-job/background-job-queries.ts";
import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import {
  getFellowshipLogsDungeonRunsQueryOptions,
  getFellowshipLogsLastKnownRateLimitDataQueryOptions,
} from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { makeBackgroundJobEventStore } from "@/renderer/stores/background-job/background-job-event-store.ts";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

const QUEUED_JOB = makeImportJob("job-1", "QUEUED");

const SUCCEEDED_JOB = makeImportJob("job-1", "SUCCEEDED", {
  attempts: 1,
  finishedAtMilliseconds: 2,
  result: {
    approximatePointsSpent: 12,
    dungeonRunId: Schema.decodeSync(DungeonRunIdSchema)("dungeon-run-1"),
  },
  startedAtMilliseconds: 1,
});

function makeSnapshot(
  overrides: Partial<BackgroundJobApiSnapshot>,
): BackgroundJobApiSnapshot {
  return { jobs: [], revision: 0, sessionId: "session", ...overrides };
}

function toMessageEvents(
  snapshots: ReadonlyArray<BackgroundJobApiSnapshot>,
): ReadonlyArray<BackgroundJobEventStreamEvent> {
  return snapshots.map((snapshot) => {
    return {
      message: { snapshot, version: 1 },
      type: "MESSAGE_RECEIVED",
    };
  });
}

function getCachedSnapshot(queryClient: QueryClient) {
  return queryClient.getQueryData<BackgroundJobApiSnapshot>(
    getBackgroundJobsQueryOptions().queryKey,
  );
}

describe("BackgroundJobEventStore", () => {
  test("writes snapshots from the event stream into the query cache", async () => {
    const queryClient = new QueryClient();
    const snapshot = makeSnapshot({ jobs: [QUEUED_JOB], revision: 1 });

    const store = makeBackgroundJobEventStore({
      makeEventStream: () => {
        return Stream.fromIterable(toMessageEvents([snapshot]));
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(getCachedSnapshot(queryClient)).toEqual(snapshot);
    });
  });

  test("ignores a snapshot older than the cached one", async () => {
    const queryClient = new QueryClient();
    const newer = makeSnapshot({ jobs: [QUEUED_JOB], revision: 5 });
    const older = makeSnapshot({ revision: 3 });
    const connected = {
      state: API_EVENT_CONNECTION_STATE.CONNECTED,
      type: "CONNECTION_STATE_CHANGED",
    } satisfies BackgroundJobEventStreamEvent;

    const store = makeBackgroundJobEventStore({
      makeEventStream: () => {
        return Stream.fromIterable([
          ...toMessageEvents([newer, older]),
          connected,
        ]);
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(store.getSnapshot().eventConnectionState).toBe(
        API_EVENT_CONNECTION_STATE.CONNECTED,
      );
    });

    expect(getCachedSnapshot(queryClient)).toEqual(newer);
  });

  test("accepts an older revision from a restarted API", async () => {
    const queryClient = new QueryClient();
    const beforeRestart = makeSnapshot({ jobs: [QUEUED_JOB], revision: 5 });
    const afterRestart = makeSnapshot({ revision: 1, sessionId: "restarted" });

    const store = makeBackgroundJobEventStore({
      makeEventStream: () => {
        return Stream.fromIterable(
          toMessageEvents([beforeRestart, afterRestart]),
        );
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(getCachedSnapshot(queryClient)).toEqual(afterRestart);
    });
  });

  test("refreshes imported runs and rate limit data when an import succeeds", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const store = makeBackgroundJobEventStore({
      makeEventStream: () => {
        return Stream.fromIterable(
          toMessageEvents([
            makeSnapshot({ jobs: [QUEUED_JOB], revision: 1 }),
            makeSnapshot({ jobs: [SUCCEEDED_JOB], revision: 2 }),
          ]),
        );
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: getFellowshipLogsDungeonRunsQueryOptions().queryKey,
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getFellowshipLogsLastKnownRateLimitDataQueryOptions().queryKey,
    });
  });

  test("doesn't refresh anything while jobs are only queued", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const store = makeBackgroundJobEventStore({
      makeEventStream: () => {
        return Stream.fromIterable(
          toMessageEvents([makeSnapshot({ jobs: [QUEUED_JOB], revision: 1 })]),
        );
      },
      queryClient,
    });

    store.start();

    await vi.waitFor(() => {
      expect(getCachedSnapshot(queryClient)?.revision).toBe(1);
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
