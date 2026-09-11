import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { type AppState, DEFAULT_APP_STATE } from "./app-state-schema.ts";
import { migratePersistedAppState } from "./persistence/app-state-migrations.ts";
import {
  CURRENT_APP_STATE_VERSION,
  PersistedAppStateSchema,
} from "./persistence/app-state-persistence-schema.ts";

const APP_STATE_KEY = "app-state";

export type AppStateStorageError =
  | KeyValueStore.KeyValueStoreError
  | Schema.SchemaError;

export type AppStateStorageShape = {
  readonly get: E.Effect<AppState, AppStateStorageError>;

  readonly set: (state: AppState) => E.Effect<void, AppStateStorageError>;

  readonly setDungeonRunVisibleTimeColumns: (
    visibleTimeColumns: AppState["dungeonRun"]["visibleTimeColumns"],
  ) => E.Effect<void, AppStateStorageError>;

  readonly setSelectedConfigurationId: (
    id: ConfigurationId | null,
  ) => E.Effect<void, AppStateStorageError>;

  readonly setSidebarOpen: (
    sidebarOpen: AppState["sidebarOpen"],
  ) => E.Effect<void, AppStateStorageError>;

  readonly setTheme: (
    theme: AppState["theme"],
  ) => E.Effect<void, AppStateStorageError>;
};

export class AppStateStorage extends Context.Service<
  AppStateStorage,
  AppStateStorageShape
>()(
  "fellowship-run-tracker/electron/storage/app-state/app-state-storage/AppStateStorage",
) {}

export const makeAppStateStorage = E.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore;

  const appStateStorage = KeyValueStore.toSchemaStore(
    keyValueStore,
    PersistedAppStateSchema,
  );

  const get = appStateStorage.get(APP_STATE_KEY).pipe(
    E.flatMap(
      Option.match({
        onNone: () => {
          return E.succeed(DEFAULT_APP_STATE);
        },
        onSome: (persistedAppState) => {
          return E.gen(function* () {
            const currentPersistedAppState =
              migratePersistedAppState(persistedAppState);

            if (
              currentPersistedAppState.version !== persistedAppState.version
            ) {
              yield* appStateStorage.set(
                APP_STATE_KEY,
                currentPersistedAppState,
              );
            }

            return currentPersistedAppState.state;
          });
        },
      }),
    ),
    E.catchTag("SchemaError", (error) => {
      return E.gen(function* () {
        yield* E.logWarning(
          "Invalid persisted app state. Resetting to defaults.",
          {
            error,
          },
        );

        yield* appStateStorage.set(APP_STATE_KEY, {
          state: DEFAULT_APP_STATE,
          version: CURRENT_APP_STATE_VERSION,
        });

        return DEFAULT_APP_STATE;
      });
    }),
  );

  const set: AppStateStorageShape["set"] = (state) => {
    return appStateStorage.set(APP_STATE_KEY, {
      state,
      version: CURRENT_APP_STATE_VERSION,
    });
  };

  const update = (
    updateState: (state: AppState) => AppState,
  ): E.Effect<void, AppStateStorageError> => {
    return E.gen(function* () {
      const state = yield* get;

      yield* set(updateState(state));
    });
  };

  const setDungeonRunVisibleTimeColumns: AppStateStorageShape["setDungeonRunVisibleTimeColumns"] =
    (visibleTimeColumns) => {
      return update((state) => {
        return {
          ...state,
          dungeonRun: {
            ...state.dungeonRun,
            visibleTimeColumns,
          },
        };
      });
    };

  const setSelectedConfigurationId: AppStateStorageShape["setSelectedConfigurationId"] =
    (id) => {
      return update((state) => {
        return {
          ...state,
          selectedConfigurationId: id,
        };
      });
    };

  const setSidebarOpen: AppStateStorageShape["setSidebarOpen"] = (
    sidebarOpen,
  ) => {
    return update((state) => {
      return {
        ...state,
        sidebarOpen,
      };
    });
  };

  const setTheme: AppStateStorageShape["setTheme"] = (theme) => {
    return update((state) => {
      return {
        ...state,
        theme,
      };
    });
  };

  return {
    get,
    set,
    setDungeonRunVisibleTimeColumns,
    setSelectedConfigurationId,
    setSidebarOpen,
    setTheme,
  } satisfies AppStateStorageShape;
});
