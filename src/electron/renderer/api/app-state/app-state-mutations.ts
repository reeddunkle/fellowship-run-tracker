import {
  mutationOptions,
  type QueryClient,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as E from "effect/Effect";

import { AppStateApiService } from "@/contracts/app-state/app-state-api-service.ts";
import { type AppState } from "@/contracts/app-state/app-state-schema.ts";
import {
  getDungeonRunComparisonGroupQueryOptions,
  getDungeonRunTimeColumnsQueryOptions,
  getSelectedConfigurationIdQueryOptions,
  getSidebarOpenQueryOptions,
  getThemeQueryOptions,
} from "@/electron/renderer/api/app-state/app-state-queries.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

type FieldMutationContext<Value> = {
  readonly previousValue: Value | undefined;
};

function cancelQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "CANCEL_QUERIES",
      });
    },
    try: () => {
      return queryClient.cancelQueries({ queryKey });
    },
  });
}

function invalidateQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "INVALIDATE_QUERIES",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({ queryKey });
    },
  });
}

function makeFieldMutationOptions<Value>({
  mutationFn,
  mutationKey,
  queryClient,
  queryKey,
}: {
  readonly mutationFn: (value: Value) => Promise<void>;
  readonly mutationKey: QueryKey;
  readonly queryClient: QueryClient;
  readonly queryKey: QueryKey;
}) {
  return mutationOptions<void, unknown, Value, FieldMutationContext<Value>>({
    mutationFn,
    mutationKey,
    onError: (_error, _value, context) => {
      if (context === undefined) {
        return;
      }

      queryClient.setQueryData(queryKey, context.previousValue);
    },
    onMutate: (value) => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          yield* cancelQuery(queryClient, queryKey);

          const previousValue = queryClient.getQueryData<Value>(queryKey);

          queryClient.setQueryData(queryKey, value);

          return { previousValue };
        }),
      );
    },
    onSettled: () => {
      return browserRuntime.runPromise(invalidateQuery(queryClient, queryKey));
    },
    scope: { id: mutationKey.join(":") },
  });
}

export function setThemeMutationOptions(queryClient: QueryClient) {
  return makeFieldMutationOptions<AppState["theme"]>({
    mutationFn: (theme) => {
      return browserRuntime.runPromise(
        AppStateApiService.use((service) => {
          return service.setTheme(theme);
        }),
      );
    },
    mutationKey: ["app-state", "theme", "set"],
    queryClient,
    queryKey: getThemeQueryOptions().queryKey,
  });
}

export function setSidebarOpenMutationOptions(queryClient: QueryClient) {
  return makeFieldMutationOptions<AppState["sidebarOpen"]>({
    mutationFn: (sidebarOpen) => {
      return browserRuntime.runPromise(
        AppStateApiService.use((service) => {
          return service.setSidebarOpen(sidebarOpen);
        }),
      );
    },
    mutationKey: ["app-state", "sidebar-open", "set"],
    queryClient,
    queryKey: getSidebarOpenQueryOptions().queryKey,
  });
}

export function setSelectedConfigurationIdMutationOptions(
  queryClient: QueryClient,
) {
  return makeFieldMutationOptions<ConfigurationId | null>({
    mutationFn: (selectedConfigurationId) => {
      return browserRuntime.runPromise(
        AppStateApiService.use((service) => {
          return service.setSelectedConfigurationId(selectedConfigurationId);
        }),
      );
    },
    mutationKey: ["app-state", "selected-configuration-id", "set"],
    queryClient,
    queryKey: getSelectedConfigurationIdQueryOptions().queryKey,
  });
}

export function setDungeonRunTimeColumnsMutationOptions(
  queryClient: QueryClient,
) {
  return makeFieldMutationOptions<AppState["dungeonRun"]["timeColumns"]>({
    mutationFn: (timeColumns) => {
      return browserRuntime.runPromise(
        AppStateApiService.use((service) => {
          return service.setDungeonRunTimeColumns(timeColumns);
        }),
      );
    },
    mutationKey: ["app-state", "dungeon-run-time-columns", "set"],
    queryClient,
    queryKey: getDungeonRunTimeColumnsQueryOptions().queryKey,
  });
}

export function setDungeonRunComparisonGroupMutationOptions(
  queryClient: QueryClient,
) {
  return makeFieldMutationOptions<typeof DungeonRunComparisonGroupSchema.Type>({
    mutationFn: (comparisonGroup) => {
      return browserRuntime.runPromise(
        AppStateApiService.use((service) => {
          return service.setDungeonRunComparisonGroup(comparisonGroup);
        }),
      );
    },
    mutationKey: ["app-state", "dungeon-run-comparison-group", "set"],
    queryClient,
    queryKey: getDungeonRunComparisonGroupQueryOptions().queryKey,
  });
}

export function useSetTheme() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(setThemeMutationOptions(queryClient));
  return mutate;
}

export function useSetSidebarOpen() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(setSidebarOpenMutationOptions(queryClient));
  return mutate;
}

export function useSetSelectedConfigurationId() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    setSelectedConfigurationIdMutationOptions(queryClient),
  );
  return mutate;
}

export function useSetDungeonRunTimeColumns() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    setDungeonRunTimeColumnsMutationOptions(queryClient),
  );
  return mutate;
}

export function useSetDungeonRunComparisonGroup() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    setDungeonRunComparisonGroupMutationOptions(queryClient),
  );
  return mutate;
}
