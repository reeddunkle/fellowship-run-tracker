import { type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import type * as Socket from "effect/unstable/socket/Socket";

import { type BackgroundJobApiSnapshot } from "@frt/shared/background-job/background-job-api-schema.ts";

import {
  type BackgroundJobEventStreamError,
  type BackgroundJobEventStreamEvent,
  makeBackgroundJobEventStream,
} from "@/renderer/api/background-job/background-job-event-stream.ts";
import {
  getBackgroundJobsQueryOptions,
  isNewerBackgroundJobSnapshot,
  setBackgroundJobSnapshot,
} from "@/renderer/api/background-job/background-job-queries.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/renderer/api/common.ts";
import {
  invalidateDungeonRunHistory,
  invalidateFellowshipLogsRateLimitData,
  invalidateImportedDungeonRuns,
} from "@/renderer/api/fellowship-logs/fellowship-logs-invalidation.ts";
import { queryClient as defaultQueryClient } from "@/renderer/query/query-client.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import { getNewlyFinishedBackgroundJobs } from "./get-newly-finished-background-jobs.ts";

type BackgroundJobEventStoreSnapshot = {
  readonly eventConnectionState: ApiEventConnectionState;
};

type Listener = () => void;

type BackgroundJobEventStreamFactory = () => Stream.Stream<
  BackgroundJobEventStreamEvent,
  BackgroundJobEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeBackgroundJobEventStoreOptions = {
  readonly makeEventStream?: BackgroundJobEventStreamFactory;
  readonly queryClient?: QueryClient;
};

export type BackgroundJobEventStore = {
  readonly getSnapshot: () => BackgroundJobEventStoreSnapshot;
  readonly start: () => void;
  readonly stop: () => void;
  readonly subscribe: (listener: Listener) => () => void;
};

const initialSnapshot: BackgroundJobEventStoreSnapshot = {
  eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
};

/*
 * Keeps the `["background-jobs"]` query in sync with the API's job snapshots,
 * and refreshes queries that depend on a job's outcome when it finishes. The
 * store itself only tracks the connection state; components read jobs through
 * the query.
 */
export function makeBackgroundJobEventStore({
  makeEventStream = makeBackgroundJobEventStream,
  queryClient = defaultQueryClient,
}: MakeBackgroundJobEventStoreOptions = {}): BackgroundJobEventStore {
  let snapshot = initialSnapshot;
  let fiber: Fiber.Fiber<void, unknown> | undefined;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function setConnectionState(
    eventConnectionState: ApiEventConnectionState,
  ): E.Effect<void> {
    return E.sync(() => {
      snapshot = { ...snapshot, eventConnectionState };

      emit();
    });
  }

  const refreshFinishedJobQueries = E.fn(
    "BackgroundJobEventStore.refreshFinishedJobQueries",
  )(function* ({
    next,
    previous,
  }: {
    readonly next: BackgroundJobApiSnapshot;
    readonly previous: BackgroundJobApiSnapshot | undefined;
  }) {
    const finishedJobs = getNewlyFinishedBackgroundJobs(previous, next);

    if (finishedJobs.length === 0) {
      return;
    }

    // Imports spend Fellowship Logs points whether or not they succeed.
    yield* invalidateFellowshipLogsRateLimitData(queryClient);

    const hasSucceededImport = finishedJobs.some((job) => {
      return (
        job.kind === "ImportFellowshipLogsDungeonRun" &&
        job.status === "SUCCEEDED"
      );
    });

    if (hasSucceededImport) {
      yield* invalidateImportedDungeonRuns(queryClient);
      yield* invalidateDungeonRunHistory(queryClient);
    }
  });

  const handleSnapshot = (next: BackgroundJobApiSnapshot) => {
    return E.gen(function* () {
      const previous = queryClient.getQueryData(
        getBackgroundJobsQueryOptions().queryKey,
      );

      if (!isNewerBackgroundJobSnapshot(previous, next)) {
        return;
      }

      setBackgroundJobSnapshot(queryClient, next);

      // A failed refresh shouldn't end the stream; the next change retries.
      yield* refreshFinishedJobQueries({ next, previous }).pipe(
        E.catch((error) => {
          return E.logWarning(
            "Failed to refresh queries after a job finished.",
            {
              error,
            },
          );
        }),
      );
    });
  };

  const handleBackgroundJobEvent =
    Match.type<BackgroundJobEventStreamEvent>().pipe(
      Match.when({ type: "CONNECTION_STATE_CHANGED" }, (event) => {
        return setConnectionState(event.state);
      }),
      Match.when({ type: "MESSAGE_RECEIVED" }, (event) => {
        return handleSnapshot(event.message.snapshot);
      }),
      Match.exhaustive,
    );

  function start(): void {
    if (fiber !== undefined) {
      return;
    }

    const program = makeEventStream().pipe(
      Stream.runForEach(handleBackgroundJobEvent),
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("Background job event stream failed.", {
            error,
          });

          yield* setConnectionState(API_EVENT_CONNECTION_STATE.ERROR);
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

  function getSnapshot(): BackgroundJobEventStoreSnapshot {
    return snapshot;
  }

  return {
    getSnapshot,
    start,
    stop,
    subscribe,
  };
}

export const backgroundJobEventStore = makeBackgroundJobEventStore();
