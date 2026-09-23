import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as E from "effect/Effect";

import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import { updateCachedBackgroundJobs } from "@/renderer/api/background-job/background-job-queries.ts";
import {
  getDungeonRunMetadata,
  getRateLimitData,
  queueDungeonRunImport,
} from "@/renderer/api/fellowship-logs/fellowship-logs-client.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import {
  type DeleteImportedDungeonRunArgs,
  deleteImportedDungeonRun,
} from "./fellowship-logs-client.ts";
import {
  invalidateDungeonRunHistory,
  invalidateFellowshipLogsRateLimitData,
  invalidateImportedDungeonRuns,
} from "./fellowship-logs-invalidation.ts";
import {
  getFellowshipLogsDungeonRunsQueryOptions,
  getFellowshipLogsLastKnownRateLimitDataQueryOptions,
} from "./fellowship-logs-queries.ts";

type ImportedDungeonRunsMutationContext = {
  readonly previousImportedDungeonRuns:
    | FellowshipLogsApiImportedDungeonRunList
    | undefined;
};

function getImportedDungeonRunsQueryKey() {
  return getFellowshipLogsDungeonRunsQueryOptions().queryKey;
}

function getDungeonRunMetadataMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (options: FellowshipLogsApiDungeonRunReference) => {
      return browserRuntime.runPromise(getDungeonRunMetadata(options));
    },
    mutationKey: ["fellowship-logs", "dungeon-run-metadata"],
    onSettled: () => {
      return browserRuntime.runPromise(
        invalidateFellowshipLogsRateLimitData(queryClient),
      );
    },
  });
}

/*
 * Resolves once the import is durably queued. The job is added to the cached
 * queue straight away so it shows before the WebSocket's next snapshot; the
 * event store refreshes imported runs once the job finishes.
 */
function queueDungeonRunImportMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (options: FellowshipLogsApiQueueDungeonRunImportOptions) => {
      return browserRuntime.runPromise(queueDungeonRunImport(options));
    },
    mutationKey: ["fellowship-logs", "import-jobs", "queue"],
    onSuccess: ({ job }) => {
      updateCachedBackgroundJobs(queryClient, (jobs) => {
        return jobs.some((cachedJob) => {
          return cachedJob.id === job.id;
        })
          ? jobs
          : [...jobs, job];
      });
    },
  });
}

function refreshFellowshipLogsRateLimitDataMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: () => {
      return browserRuntime.runPromise(getRateLimitData());
    },
    mutationKey: ["fellowship-logs", "rate-limit-data", "refresh"],
    onSuccess: (rateLimitData) => {
      queryClient.setQueryData(
        getFellowshipLogsLastKnownRateLimitDataQueryOptions().queryKey,
        rateLimitData,
      );
    },
  });
}

function deleteImportedDungeonRunMutationOptions(queryClient: QueryClient) {
  return mutationOptions<
    void,
    unknown,
    DeleteImportedDungeonRunArgs,
    ImportedDungeonRunsMutationContext
  >({
    mutationFn: (args) => {
      return browserRuntime.runPromise(deleteImportedDungeonRun(args));
    },
    mutationKey: ["fellowship-logs", "dungeon-runs", "delete"],
    onError: (_error, _args, context) => {
      if (context === undefined) {
        return;
      }

      queryClient.setQueryData<FellowshipLogsApiImportedDungeonRunList>(
        getImportedDungeonRunsQueryKey(),
        context.previousImportedDungeonRuns,
      );
    },
    onMutate: (args) => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          yield* E.tryPromise({
            catch: (cause) => {
              return new QueryClientOperationError({
                cause,
                operation: "CancelQueries",
              });
            },
            try: () => {
              return queryClient.cancelQueries({
                queryKey: getImportedDungeonRunsQueryKey(),
              });
            },
          });

          const previousImportedDungeonRuns =
            queryClient.getQueryData<FellowshipLogsApiImportedDungeonRunList>(
              getImportedDungeonRunsQueryKey(),
            );

          queryClient.setQueryData<
            FellowshipLogsApiImportedDungeonRunList | undefined
          >(getImportedDungeonRunsQueryKey(), (importedDungeonRuns) => {
            if (importedDungeonRuns === undefined) {
              return importedDungeonRuns;
            }

            return importedDungeonRuns.filter((importedDungeonRun) => {
              return importedDungeonRun.dungeonRunId !== args.dungeonRunId;
            });
          });

          return {
            previousImportedDungeonRuns,
          };
        }),
      );
    },
    onSettled: () => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          yield* invalidateImportedDungeonRuns(queryClient);
          yield* invalidateDungeonRunHistory(queryClient);
        }),
      );
    },
  });
}

export function useRefreshFellowshipLogsRateLimitData() {
  const queryClient = useQueryClient();
  const { mutate, data, error, isError, isPending } = useMutation(
    refreshFellowshipLogsRateLimitDataMutationOptions(queryClient),
  );
  return { data, error, isError, isPending, refresh: mutate };
}

export function useDungeonRunMetadata() {
  const queryClient = useQueryClient();
  const { mutate, data, error, isPending, reset, variables } = useMutation(
    getDungeonRunMetadataMutationOptions(queryClient),
  );
  return { data, error, isPending, lookup: mutate, reset, variables };
}

export function useQueueDungeonRunImport() {
  const queryClient = useQueryClient();
  const { mutate, data, error, isPending, reset } = useMutation(
    queueDungeonRunImportMutationOptions(queryClient),
  );
  return { data, error, isPending, queueImport: mutate, reset };
}

export function useDeleteImportedDungeonRun() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, variables } = useMutation(
    deleteImportedDungeonRunMutationOptions(queryClient),
  );
  return { delete: mutate, error, isPending, variables };
}
