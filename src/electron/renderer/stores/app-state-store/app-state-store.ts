import * as E from "effect/Effect";

import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import {
  type AppState,
  DEFAULT_APP_STATE,
  type DungeonRunTimeColumnState,
  type Theme,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateInitializationError } from "@/errors/app-state-error.ts";
import { AppStateService } from "@/services/app-state/app-state-service.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

type Listener = () => void;

type DungeonRunComparisonGroup = typeof DungeonRunComparisonGroupSchema.Type;

export type AppStoreActions = {
  readonly setDungeonRunComparisonGroup: (
    comparisonGroup: DungeonRunComparisonGroup,
  ) => void;

  readonly setDungeonRunTimeColumns: (
    timeColumns: ReadonlyArray<DungeonRunTimeColumnState>,
  ) => void;

  readonly setSelectedConfigurationId: (
    selectedConfigurationId: ConfigurationId | null,
  ) => void;

  readonly setSidebarOpen: (sidebarOpen: boolean) => void;

  readonly setTheme: (theme: Theme) => void;
};

export type AppStore = {
  readonly getSnapshot: () => AppState;
  readonly initialize: E.Effect<void, AppStateInitializationError>;
  readonly subscribe: (listener: Listener) => () => void;
} & AppStoreActions;

export function makeAppStore(
  initialState: AppState = DEFAULT_APP_STATE,
): AppStore {
  let snapshot: AppState = initialState;
  let isInitialized = false;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function persist(state: AppState): void {
    browserRuntime.runFork(
      E.gen(function* () {
        const appStateService = yield* AppStateService;

        yield* appStateService.set(state);
      }).pipe(E.catchCause(E.logError)),
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

    return E.tryPromise({
      catch: (cause) => {
        return new AppStateInitializationError({
          cause,
        });
      },
      try: () => {
        return browserRuntime.runPromise(
          E.gen(function* () {
            const appStateService = yield* AppStateService;

            return yield* appStateService.get;
          }),
        );
      },
    }).pipe(
      E.tap((state) => {
        return E.sync(() => {
          snapshot = state;
          isInitialized = true;

          emit();
        });
      }),
      E.asVoid,
    );
  });

  function setDungeonRunComparisonGroup(
    comparisonGroup: DungeonRunComparisonGroup,
  ): void {
    updateSnapshot((state) => {
      return {
        ...state,
        dungeonRun: {
          ...state.dungeonRun,
          comparisonGroup,
        },
      };
    });
  }

  function setDungeonRunTimeColumns(
    timeColumns: ReadonlyArray<DungeonRunTimeColumnState>,
  ): void {
    updateSnapshot((state) => {
      return {
        ...state,
        dungeonRun: {
          ...state.dungeonRun,
          timeColumns,
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
    setDungeonRunComparisonGroup,
    setDungeonRunTimeColumns,
    setSelectedConfigurationId,
    setSidebarOpen,
    setTheme,
    subscribe,
  };
}

export const appStore = makeAppStore();
