import * as E from "effect/Effect";

import * as appStateClient from "@/electron/renderer/api/electron-ipc/app-state/app-state-client";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import {
  type AppState,
  DEFAULT_APP_STATE,
  type DungeonRunTimeColumn,
  type Theme,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type Listener = () => void;

export type AppStoreActions = {
  readonly setDungeonRunVisibleTimeColumns: (
    visibleTimeColumns: ReadonlyArray<DungeonRunTimeColumn>,
  ) => void;

  readonly setSelectedConfigurationId: (
    selectedConfigurationId: ConfigurationId | null,
  ) => void;

  readonly setSidebarOpen: (sidebarOpen: boolean) => void;

  readonly setTheme: (theme: Theme) => void;
};

export type AppStore = {
  readonly getSnapshot: () => AppState;
  readonly initialize: E.Effect<void, Error>;
  readonly subscribe: (listener: Listener) => () => void;
} & AppStoreActions;

export function makeAppStore(): AppStore {
  let snapshot: AppState = DEFAULT_APP_STATE;
  let isInitialized = false;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function persist(state: AppState): void {
    browserRuntime.runFork(
      appStateClient.setAppState(state).pipe(E.catchCause(E.logError)),
    );
  }

  function updateSnapshot(update: (state: AppState) => AppState): void {
    const nextSnapshot = update(snapshot);

    snapshot = nextSnapshot;

    emit();
    persist(nextSnapshot);
  }

  const initialize = E.suspend(() => {
    if (isInitialized) {
      return E.void;
    }

    return E.gen(function* () {
      const state = yield* appStateClient.getAppState;

      snapshot = state;
      isInitialized = true;

      emit();
    });
  });

  function setDungeonRunVisibleTimeColumns(
    visibleTimeColumns: ReadonlyArray<DungeonRunTimeColumn>,
  ): void {
    updateSnapshot((state) => {
      return {
        ...state,
        dungeonRun: {
          ...state.dungeonRun,
          visibleTimeColumns,
        },
      };
    });
  }

  function setSelectedConfigurationId(
    selectedConfigurationId: ConfigurationId | null,
  ): void {
    updateSnapshot((state) => {
      return {
        ...state,
        selectedConfigurationId,
      };
    });
  }

  function setSidebarOpen(sidebarOpen: boolean): void {
    updateSnapshot((state) => {
      return {
        ...state,
        sidebarOpen,
      };
    });
  }

  function setTheme(theme: Theme): void {
    updateSnapshot((state) => {
      return {
        ...state,
        theme,
      };
    });
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): AppState {
    return snapshot;
  }

  return {
    getSnapshot,
    initialize,
    setDungeonRunVisibleTimeColumns,
    setSelectedConfigurationId,
    setSidebarOpen,
    setTheme,
    subscribe,
  };
}

export const appStore = makeAppStore();
