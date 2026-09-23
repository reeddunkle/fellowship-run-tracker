import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type * as E from "effect/Effect";

import {
  type BackgroundJobApiItem,
  type BackgroundJobApiSnapshot,
} from "@frt/shared/background-job/background-job-api-schema.ts";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";
import { type AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

import {
  type BackgroundJobCommandArgs,
  cancelBackgroundJob,
  dismissBackgroundJob,
  retryBackgroundJob,
} from "./background-job-client.ts";
import {
  getBackgroundJobsQueryOptions,
  updateCachedBackgroundJobs,
} from "./background-job-queries.ts";

type BackgroundJobMutationContext = {
  readonly previousSnapshot: BackgroundJobApiSnapshot | undefined;
};

type BackgroundJobCommandMutationOptions = {
  readonly command: (
    args: BackgroundJobCommandArgs,
  ) => E.Effect<void, unknown, AppApiClient>;
  readonly mutationKey: ReadonlyArray<string>;
  readonly optimisticUpdate: (
    jobs: ReadonlyArray<BackgroundJobApiItem>,
    args: BackgroundJobCommandArgs,
  ) => ReadonlyArray<BackgroundJobApiItem>;
};

function withoutJob(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  { id }: BackgroundJobCommandArgs,
): ReadonlyArray<BackgroundJobApiItem> {
  return jobs.filter((job) => {
    return job.id !== id;
  });
}

function withJobRequeued(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  { id }: BackgroundJobCommandArgs,
): ReadonlyArray<BackgroundJobApiItem> {
  return jobs.map((job) => {
    return job.id === id
      ? {
          ...job,
          error: null,
          finishedAtMilliseconds: null,
          startedAtMilliseconds: null,
          status: "QUEUED",
        }
      : job;
  });
}

/*
 * Commands update the cache optimistically and roll back on failure. No
 * invalidation afterwards: the WebSocket pushes the server's new snapshot.
 */
function backgroundJobCommandMutationOptions(
  queryClient: QueryClient,
  {
    command,
    mutationKey,
    optimisticUpdate,
  }: BackgroundJobCommandMutationOptions,
) {
  const queryKey = getBackgroundJobsQueryOptions().queryKey;

  return mutationOptions<
    void,
    unknown,
    BackgroundJobCommandArgs,
    BackgroundJobMutationContext
  >({
    mutationFn: (args) => {
      return browserRuntime.runPromise(command(args));
    },
    mutationKey: ["background-jobs", ...mutationKey],
    onError: (_error, _args, context) => {
      if (context === undefined) {
        return;
      }

      queryClient.setQueryData(queryKey, context.previousSnapshot);
    },
    onMutate: (args) => {
      const previousSnapshot = queryClient.getQueryData(queryKey);

      updateCachedBackgroundJobs(queryClient, (jobs) => {
        return optimisticUpdate(jobs, args);
      });

      return { previousSnapshot };
    },
  });
}

export function useCancelBackgroundJob() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, variables } = useMutation(
    backgroundJobCommandMutationOptions(queryClient, {
      command: cancelBackgroundJob,
      mutationKey: ["cancel"],
      optimisticUpdate: withoutJob,
    }),
  );
  return { cancel: mutate, error, isPending, variables };
}

export function useRetryBackgroundJob() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, variables } = useMutation(
    backgroundJobCommandMutationOptions(queryClient, {
      command: retryBackgroundJob,
      mutationKey: ["retry"],
      optimisticUpdate: withJobRequeued,
    }),
  );
  return { error, isPending, retry: mutate, variables };
}

export function useDismissBackgroundJob() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, variables } = useMutation(
    backgroundJobCommandMutationOptions(queryClient, {
      command: dismissBackgroundJob,
      mutationKey: ["dismiss"],
      optimisticUpdate: withoutJob,
    }),
  );
  return { dismiss: mutate, error, isPending, variables };
}
