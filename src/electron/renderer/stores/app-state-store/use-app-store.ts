import { useSyncExternalStore } from "react";

import {
  type AppState,
  type DungeonRunState,
} from "@/electron/storage/app-state/app-state-schema.ts";

import {
  type AppStore,
  type AppStoreActions,
  appStore,
} from "./app-state-store.ts";

export type UseAppStoreResult = AppState & AppStoreActions;

export type UseDungeonRunAppStoreResult = DungeonRunState & {
  readonly setComparisonGroup: AppStoreActions["setDungeonRunComparisonGroup"];
  readonly setTimeColumns: AppStoreActions["setDungeonRunTimeColumns"];
};

export function useAppStore(store: AppStore = appStore): UseAppStoreResult {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  return {
    ...state,
    setDungeonRunComparisonGroup: store.setDungeonRunComparisonGroup,
    setDungeonRunTimeColumns: store.setDungeonRunTimeColumns,
    setSelectedConfigurationId: store.setSelectedConfigurationId,
    setSidebarOpen: store.setSidebarOpen,
    setTheme: store.setTheme,
  };
}

export function useDungeonRunAppStore(
  store: AppStore = appStore,
): UseDungeonRunAppStoreResult {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  return {
    ...state.dungeonRun,
    setComparisonGroup: store.setDungeonRunComparisonGroup,
    setTimeColumns: store.setDungeonRunTimeColumns,
  };
}
