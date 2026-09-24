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
} from "./background-job-categories.ts";
import { getBackgroundJobs } from "./background-job-client.ts";

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

function filterBackgroundJobsByCategory(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  categoryId: BackgroundJobCategoryId,
): ReadonlyArray<BackgroundJobApiItem> {
  return jobs.filter((job) => {
    return getBackgroundJobCategoryId(job) === categoryId;
  });
}

export function useBackgroundJobCategorySuspense(
  categoryId: BackgroundJobCategoryId,
) {
  const { data } = useSuspenseQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return filterBackgroundJobsByCategory(snapshot.jobs, categoryId);
    },
  });
  return data;
}

export function useBackgroundJobSummary(categoryId: BackgroundJobCategoryId) {
  const { data } = useQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return getBackgroundJobSummary(
        filterBackgroundJobsByCategory(snapshot.jobs, categoryId),
      );
    },
  });
  return data ?? getBackgroundJobSummary([]);
}
