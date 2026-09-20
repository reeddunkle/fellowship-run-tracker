import { type QueryClient } from "@tanstack/react-query";

import {
  getDungeonRunComparisonGroupQueryOptions,
  getDungeonRunTimeColumnsQueryOptions,
  getSelectedConfigurationIdQueryOptions,
  getSidebarOpenQueryOptions,
  getThemeQueryOptions,
} from "@/electron/renderer/api/app-state/app-state-queries.ts";
import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

export function seedAppStateQueries(
  queryClient: QueryClient,
  appState: AppState,
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
