import {
  type QueryClient,
  queryOptions,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type * as E from "effect/Effect";

import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import {
  AppStateApiService,
  type AppStateApiServiceShape,
} from "@/services/api/app-state/app-state-api-service.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

function makeAppStateFieldQueryOptions<Value>(
  field: string,
  select: (service: AppStateApiServiceShape) => E.Effect<Value, unknown>,
) {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(AppStateApiService.use(select));
    },
    queryKey: ["app-state", field] as const,
    // If an independent renderer is added, add explicit refetch-on-focus or visibility invalidation
    staleTime: Infinity,
  });
}

export function getThemeQueryOptions() {
  return makeAppStateFieldQueryOptions<AppState["theme"]>(
    "theme",
    (service) => {
      return service.getTheme;
    },
  );
}

export function getSidebarOpenQueryOptions() {
  return makeAppStateFieldQueryOptions<AppState["sidebarOpen"]>(
    "sidebar-open",
    (service) => {
      return service.getSidebarOpen;
    },
  );
}

export function getSelectedConfigurationIdQueryOptions() {
  return makeAppStateFieldQueryOptions<ConfigurationId | null>(
    "selected-configuration-id",
    (service) => {
      return service.getSelectedConfigurationId;
    },
  );
}

export function getDungeonRunTimeColumnsQueryOptions() {
  return makeAppStateFieldQueryOptions<AppState["dungeonRun"]["timeColumns"]>(
    "dungeon-run-time-columns",
    (service) => {
      return service.getDungeonRunTimeColumns;
    },
  );
}

export function getDungeonRunComparisonGroupQueryOptions() {
  return makeAppStateFieldQueryOptions<
    typeof DungeonRunComparisonGroupSchema.Type
  >("dungeon-run-comparison-group", (service) => {
    return service.getDungeonRunComparisonGroup;
  });
}

export function primeAppStateQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.ensureQueryData(getThemeQueryOptions()),
    queryClient.ensureQueryData(getSidebarOpenQueryOptions()),
    queryClient.ensureQueryData(getSelectedConfigurationIdQueryOptions()),
    queryClient.ensureQueryData(getDungeonRunTimeColumnsQueryOptions()),
    queryClient.ensureQueryData(getDungeonRunComparisonGroupQueryOptions()),
  ]);
}

export function useTheme() {
  return useSuspenseQuery(getThemeQueryOptions()).data;
}

export function useSidebarOpen() {
  return useSuspenseQuery(getSidebarOpenQueryOptions()).data;
}

export function useSelectedConfigurationId() {
  return useSuspenseQuery(getSelectedConfigurationIdQueryOptions()).data;
}

export function useDungeonRunTimeColumns() {
  return useSuspenseQuery(getDungeonRunTimeColumnsQueryOptions()).data;
}

export function useDungeonRunComparisonGroup() {
  return useSuspenseQuery(getDungeonRunComparisonGroupQueryOptions()).data;
}
