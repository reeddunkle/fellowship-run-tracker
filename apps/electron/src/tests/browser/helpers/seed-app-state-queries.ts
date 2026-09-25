import { type QueryClient } from "@tanstack/react-query";

import { type AppStateValue } from "@frt/shared/app-state/app-state-schema.ts";

import {
  getDungeonRunComparisonGroupQueryOptions,
  getDungeonRunTimeColumnsQueryOptions,
  getSelectedConfigurationIdQueryOptions,
  getSidebarOpenQueryOptions,
  getThemeQueryOptions,
} from "@/renderer/api/app-state/app-state-queries.ts";

export function seedAppStateQueries(
  queryClient: QueryClient,
  appState: AppStateValue,
): void {
  queryClient.setQueryData(getThemeQueryOptions().queryKey, appState.theme);
  queryClient.setQueryData(
    getSidebarOpenQueryOptions().queryKey,
    appState.sidebarOpen,
  );
  queryClient.setQueryData(
    getSelectedConfigurationIdQueryOptions().queryKey,
    appState.selectedConfigurationId,
  );
  queryClient.setQueryData(
    getDungeonRunTimeColumnsQueryOptions().queryKey,
    appState.dungeonRun.timeColumns,
  );
  queryClient.setQueryData(
    getDungeonRunComparisonGroupQueryOptions().queryKey,
    appState.dungeonRun.comparisonGroup,
  );
}
