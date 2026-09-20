import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as E from "effect/Effect";

import { DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX } from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import {
  getDungeonRunMetadata,
  getRateLimitData,
  importDungeonRun,
} from "@/electron/renderer/api/fellowship-logs/fellowship-logs-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportDungeonRunOptions,
  type FellowshipLogsApiImportedDungeonRunList,
} from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

import {
  type DeleteImportedDungeonRunArgs,
  deleteImportedDungeonRun,
} from "./fellowship-logs-client.ts";
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

function invalidateImportedDungeonRuns(
  queryClient: QueryClient,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "INVALIDATE_QUERIES",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({
        queryKey: getImportedDungeonRunsQueryKey(),
      });
    },
  });
}

function invalidateDungeonRunHistory(
  queryClient: QueryClient,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "INVALIDATE_QUERIES",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({
        queryKey: DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
      });
    },
  });
}

function invalidateFellowshipLogsRateLimitData(
  queryClient: QueryClient,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "INVALIDATE_QUERIES",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({
        queryKey:
          getFellowshipLogsLastKnownRateLimitDataQueryOptions().queryKey,
      });
    },
  });
}

export function getDungeonRunMetadataMutationOptions(queryClient: QueryClient) {
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

export function importDungeonRunMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (options: FellowshipLogsApiImportDungeonRunOptions) => {
      return browserRuntime.runPromise(importDungeonRun(options));
    },
    mutationKey: ["fellowship-logs", "dungeon-runs", "import"],
    onSettled: () => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          yield* invalidateImportedDungeonRuns(queryClient);
          yield* invalidateDungeonRunHistory(queryClient);
          yield* invalidateFellowshipLogsRateLimitData(queryClient);
        }),
      );
    },
  });
}

export function refreshFellowshipLogsRateLimitDataMutationOptions(
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

export function deleteImportedDungeonRunMutationOptions(
  queryClient: QueryClient,
) {
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
                operation: "CANCEL_QUERIES",
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

export function useImportDungeonRun() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, reset } = useMutation(
    importDungeonRunMutationOptions(queryClient),
  );
  return { error, importRun: mutate, isPending, reset };
}

export function useDeleteImportedDungeonRun() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending, variables } = useMutation(
    deleteImportedDungeonRunMutationOptions(queryClient),
  );
  return { delete: mutate, error, isPending, variables };
}
