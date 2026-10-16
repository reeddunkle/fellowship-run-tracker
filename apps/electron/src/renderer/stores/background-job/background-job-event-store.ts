import { type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";
import type * as Stream from "effect/Stream";
import type * as Socket from "effect/socket/Socket";

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
  invalidateDungeonRunHistory,
  invalidateFellowshipLogsRateLimitData,
  invalidateImportedDungeonRuns,
} from "@/renderer/api/fellowship-logs/fellowship-logs-invalidation.ts";
import { queryClient as defaultQueryClient } from "@/renderer/query/query-client.ts";
import {
  type ApiEventStoreSnapshot,
  type ManualApiEventStore,
  makeApiEventStore,
} from "@/renderer/stores/make-api-event-store.ts";

import {
  getNewlyFinishedBackgroundJobs,
  getNewlyWaitingBackgroundJobs,
} from "./get-newly-finished-background-jobs.ts";

type BackgroundJobEventState = Record<never, never>;

type BackgroundJobEventStoreSnapshot =
  ApiEventStoreSnapshot<BackgroundJobEventState>;

type BackgroundJobEventStreamFactory = () => Stream.Stream<
  BackgroundJobEventStreamEvent,
  BackgroundJobEventStreamError,
  Socket.WebSocketConstructor
>;

export type MakeBackgroundJobEventStoreOptions = {
  readonly makeEventStream?: BackgroundJobEventStreamFactory;
  readonly queryClient?: QueryClient;
};

export type BackgroundJobEventStore =
  ManualApiEventStore<BackgroundJobEventStoreSnapshot>;

const initialState: BackgroundJobEventState = {};

export function makeBackgroundJobEventStore({
  makeEventStream = makeBackgroundJobEventStream,
  queryClient = defaultQueryClient,
}: MakeBackgroundJobEventStoreOptions = {}): BackgroundJobEventStore {
  const refreshFinishedJobQueries = E.fnUntraced(function* ({
    next,
    previous,
  }: {
    readonly next: BackgroundJobApiSnapshot;
    readonly previous: BackgroundJobApiSnapshot | undefined;
  }) {
    const finishedJobs = getNewlyFinishedBackgroundJobs(previous, next);
    const waitingJobs = getNewlyWaitingBackgroundJobs(previous, next);

    if (finishedJobs.length === 0 && waitingJobs.length === 0) {
      return;
    }

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

  const handleSnapshot = E.fnUntraced(
    function* (next: BackgroundJobApiSnapshot) {
      const previous = queryClient.getQueryData(
        getBackgroundJobsQueryOptions().queryKey,
      );

      if (!isNewerBackgroundJobSnapshot(previous, next)) {
        return;
      }

      setBackgroundJobSnapshot(queryClient, next);

      yield* refreshFinishedJobQueries({ next, previous });
    },
    E.catch((error) => {
      return E.logWarning("Failed to refresh queries after a job finished.", {
        error,
      });
    }),
  );

  return makeApiEventStore({
    initialState,
    label: "Background job",
    lifecycle: "manual",
    makeEventStream,
    onMessage: ({ message }) => {
      return handleSnapshot(message.snapshot);
    },
  });
}

export const backgroundJobEventStore = makeBackgroundJobEventStore();
