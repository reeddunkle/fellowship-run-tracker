import { useSyncExternalStore } from "react";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

import {
  type AppStore,
  type AppStoreActions,
  appStore,
} from "./app-state-store.ts";

export type UseAppStoreResult = AppState & AppStoreActions;

export function useAppStore(store: AppStore = appStore): UseAppStoreResult {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  return {
    ...state,
    setDungeonRunVisibleTimeColumns: store.setDungeonRunVisibleTimeColumns,
    setSelectedConfigurationId: store.setSelectedConfigurationId,
    setSidebarOpen: store.setSidebarOpen,
    setTheme: store.setTheme,
  };
}
