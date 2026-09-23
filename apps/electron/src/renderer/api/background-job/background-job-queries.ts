import {
  type QueryClient,
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import * as E from "effect/Effect";

import {
  type BackgroundJobApiItem,
  type BackgroundJobApiSnapshot,
} from "@frt/shared/background-job/background-job-api-schema.ts";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import {
  type BackgroundJobCategoryId,
  getBackgroundJobCategoryId,
  getBackgroundJobSummary,
  groupBackgroundJobsByCategory,
} from "./background-job-categories.ts";
import { getBackgroundJobs } from "./background-job-client.ts";

/**
 * Whether `next` should replace `current`. A snapshot from a restarted API
 * (new `sessionId`) always wins; otherwise the higher revision does.
 */
export function isNewerBackgroundJobSnapshot(
  current: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): boolean {
  return (
    current === undefined ||
    current.sessionId !== next.sessionId ||
    next.revision >= current.revision
  );
}

/*
 * The WebSocket keeps this query fresh (see `background-job-event-store.ts`),
 * so it never goes stale on its own. The HTTP fetch only fills it before the
 * first socket message, and never overwrites a newer snapshot from the socket.
 */
export function getBackgroundJobsQueryOptions() {
  return queryOptions({
    queryFn: ({ client, queryKey }) => {
      return browserRuntime.runPromise(
        getBackgroundJobs().pipe(
          E.map((fetched) => {
            const current =
              client.getQueryData<BackgroundJobApiSnapshot>(queryKey);

            return current !== undefined &&
              !isNewerBackgroundJobSnapshot(current, fetched)
              ? current
              : fetched;
          }),
        ),
      );
    },
    queryKey: ["background-jobs"],
    staleTime: Infinity,
  });
}

export function setBackgroundJobSnapshot(
  queryClient: QueryClient,
  snapshot: BackgroundJobApiSnapshot,
): void {
  queryClient.setQueryData<BackgroundJobApiSnapshot>(
    getBackgroundJobsQueryOptions().queryKey,
    (current) => {
      return isNewerBackgroundJobSnapshot(current, snapshot)
        ? snapshot
        : current;
    },
  );
}

/**
 * Applies an optimistic change to the cached jobs. The next snapshot from the
 * socket replaces it with the server's view.
 */
export function updateCachedBackgroundJobs(
  queryClient: QueryClient,
  update: (
    jobs: ReadonlyArray<BackgroundJobApiItem>,
  ) => ReadonlyArray<BackgroundJobApiItem>,
): void {
  queryClient.setQueryData<BackgroundJobApiSnapshot>(
    getBackgroundJobsQueryOptions().queryKey,
    (current) => {
      return current === undefined
        ? current
        : { ...current, jobs: update(current.jobs) };
    },
  );
}

export function useBackgroundJobGroupsSuspense() {
  const { data } = useSuspenseQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return groupBackgroundJobsByCategory(snapshot.jobs);
    },
  });
  return data;
}

/** One category's jobs, in queue order. */
export function useBackgroundJobCategorySuspense(
  categoryId: BackgroundJobCategoryId,
) {
  const { data } = useSuspenseQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return snapshot.jobs.filter((job) => {
        return getBackgroundJobCategoryId(job) === categoryId;
      });
    },
  });
  return data;
}

/** Doesn't suspend, so it can live in the always-visible nav. */
export function useBackgroundJobSummary() {
  const { data } = useQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return getBackgroundJobSummary(snapshot.jobs);
    },
  });
  return data ?? getBackgroundJobSummary([]);
}
