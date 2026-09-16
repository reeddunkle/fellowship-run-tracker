import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";

import {
  getDungeonRunMetadata,
  importDungeonRun,
} from "@/electron/renderer/api/fellowship-logs/fellowship-logs-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportedDungeonRunList,
} from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

import {
  type DeleteImportedDungeonRunArgs,
  deleteImportedDungeonRun,
} from "./fellowship-logs-client.ts";
import { getFellowshipLogsDungeonRunsQueryOptions } from "./fellowship-logs-queries.ts";

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

export function getDungeonRunMetadataMutationOptions() {
  return mutationOptions({
    mutationFn: (options: FellowshipLogsApiDungeonRunReference) => {
      return browserRuntime.runPromise(getDungeonRunMetadata(options));
    },
    mutationKey: ["fellowship-logs", "dungeon-run-metadata"],
  });
}

export function importDungeonRunMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (options: FellowshipLogsApiDungeonRunReference) => {
      return browserRuntime.runPromise(importDungeonRun(options));
    },
    mutationKey: ["fellowship-logs", "dungeon-runs", "import"],
    onSettled: () => {
      return browserRuntime.runPromise(
        invalidateImportedDungeonRuns(queryClient),
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
        invalidateImportedDungeonRuns(queryClient),
      );
    },
  });
}
