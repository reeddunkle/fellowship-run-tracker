import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import type * as Schema from "effect/Schema";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

import { type AppState, DEFAULT_APP_STATE } from "./app-state-schema.ts";
import { migratePersistedAppState } from "./persistence/app-state-migrations.ts";
import {
  CURRENT_APP_STATE_VERSION,
  PersistedAppStateSchema,
} from "./persistence/app-state-persistence-schema.ts";

const APP_STATE_KEY = "app-state";
const CORRUPT_APP_STATE_BACKUP_KEY = "app-state-corrupt-backup";

export type AppStateStorageError =
  | KeyValueStore.KeyValueStoreError
  | Schema.SchemaError;

export type AppStateStorageShape = {
  readonly getDungeonRunComparisonGroup: E.Effect<
    typeof DungeonRunComparisonGroupSchema.Type,
    AppStateStorageError
  >;

  readonly getDungeonRunTimeColumns: E.Effect<
    AppState["dungeonRun"]["timeColumns"],
    AppStateStorageError
  >;

  readonly getSelectedConfigurationId: E.Effect<
    ConfigurationId | null,
    AppStateStorageError
  >;

  readonly getSidebarOpen: E.Effect<
    AppState["sidebarOpen"],
    AppStateStorageError
  >;

  readonly getTheme: E.Effect<AppState["theme"], AppStateStorageError>;

  readonly setDungeonRunComparisonGroup: (
    comparisonGroup: typeof DungeonRunComparisonGroupSchema.Type,
  ) => E.Effect<void, AppStateStorageError>;

  readonly setDungeonRunTimeColumns: (
    timeColumns: AppState["dungeonRun"]["timeColumns"],
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

type AppStateUpdate =
  | {
      readonly _tag: "SetDungeonRunComparisonGroup";
      readonly comparisonGroup: typeof DungeonRunComparisonGroupSchema.Type;
    }
  | {
      readonly _tag: "SetDungeonRunTimeColumns";
      readonly timeColumns: AppState["dungeonRun"]["timeColumns"];
    }
  | {
      readonly _tag: "SetSelectedConfigurationId";
      readonly selectedConfigurationId: ConfigurationId | null;
    }
  | { readonly _tag: "SetSidebarOpen"; readonly sidebarOpen: boolean }
  | { readonly _tag: "SetTheme"; readonly theme: AppState["theme"] };

type AppStateUpdateRequest = {
  readonly deferred: Deferred.Deferred<void, AppStateStorageError>;
  readonly update: AppStateUpdate;
};

function applyAppStateUpdate(
  state: AppState,
  update: AppStateUpdate,
): AppState {
  return Match.value(update).pipe(
    Match.tagsExhaustive({
      SetDungeonRunComparisonGroup: ({ comparisonGroup }) => ({
        ...state,
        dungeonRun: {
          ...state.dungeonRun,
          comparisonGroup,
        },
      }),
      SetDungeonRunTimeColumns: ({ timeColumns }) => ({
        ...state,
        dungeonRun: {
          ...state.dungeonRun,
          timeColumns,
        },
      }),
      SetSelectedConfigurationId: ({ selectedConfigurationId }) => ({
        ...state,
        selectedConfigurationId,
      }),
      SetSidebarOpen: ({ sidebarOpen }) => ({
        ...state,
        sidebarOpen,
      }),
      SetTheme: ({ theme }) => ({
        ...state,
        theme,
      }),
    }),
  );
}

export const makeAppStateStorage = E.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore;

  const appStateStorage = KeyValueStore.toSchemaStore(
    keyValueStore,
    PersistedAppStateSchema,
  );

  const readState = appStateStorage.get(APP_STATE_KEY).pipe(
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
        const invalidPersistedState = yield* keyValueStore.get(APP_STATE_KEY);

        if (invalidPersistedState !== undefined) {
          yield* keyValueStore.set(
            CORRUPT_APP_STATE_BACKUP_KEY,
            invalidPersistedState,
          );
        }

        yield* E.logWarning(
          "Invalid persisted app state. Backed it up and reset to defaults.",
          {
            backupKey: CORRUPT_APP_STATE_BACKUP_KEY,
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

  const getTheme = readState.pipe(
    E.map((state) => {
      return state.theme;
    }),
  );

  const getSidebarOpen = readState.pipe(
    E.map((state) => {
      return state.sidebarOpen;
    }),
  );

  const getSelectedConfigurationId = readState.pipe(
    E.map((state) => {
      return state.selectedConfigurationId;
    }),
  );

  const getDungeonRunTimeColumns = readState.pipe(
    E.map((state) => {
      return state.dungeonRun.timeColumns;
    }),
  );

  const getDungeonRunComparisonGroup = readState.pipe(
    E.map((state) => {
      return state.dungeonRun.comparisonGroup;
    }),
  );

  const write = (state: AppState) => {
    return appStateStorage.set(APP_STATE_KEY, {
      state,
      version: CURRENT_APP_STATE_VERSION,
    });
  };

  const queue = yield* Queue.unbounded<AppStateUpdateRequest>();

  const processBatch = E.gen(function* () {
    const requests = yield* Queue.takeAll(queue);
    const result = yield* E.result(
      E.gen(function* () {
        const state = yield* readState;
        const updatedState = requests.reduce((currentState, request) => {
          return applyAppStateUpdate(currentState, request.update);
        }, state);

        yield* write(updatedState);
      }),
    );

    yield* E.forEach(requests, ({ deferred }) => {
      return Result.match(result, {
        onFailure: (failure) => Deferred.fail(deferred, failure).pipe(E.asVoid),
        onSuccess: () => Deferred.succeed(deferred, undefined).pipe(E.asVoid),
      });
    });
  });

  const processLoop: E.Effect<never, never> = E.suspend(() => {
    return processBatch.pipe(E.andThen(processLoop));
  });

  yield* processLoop.pipe(E.tapCause(E.logError), E.forkScoped);

  const update = (appStateUpdate: AppStateUpdate) => {
    return E.gen(function* () {
      const deferred = yield* Deferred.make<void, AppStateStorageError>();

      yield* Queue.offer(queue, {
        deferred,
        update: appStateUpdate,
      });

      yield* Deferred.await(deferred);
    });
  };

  const setDungeonRunComparisonGroup: AppStateStorageShape["setDungeonRunComparisonGroup"] =
    (comparisonGroup) => {
      return update({
        _tag: "SetDungeonRunComparisonGroup",
        comparisonGroup,
      });
    };

  const setDungeonRunTimeColumns: AppStateStorageShape["setDungeonRunTimeColumns"] =
    (timeColumns) => {
      return update({
        _tag: "SetDungeonRunTimeColumns",
        timeColumns,
      });
    };

  const setSelectedConfigurationId: AppStateStorageShape["setSelectedConfigurationId"] =
    (id) => {
      return update({
        _tag: "SetSelectedConfigurationId",
        selectedConfigurationId: id,
      });
    };

  const setSidebarOpen: AppStateStorageShape["setSidebarOpen"] = (
    sidebarOpen,
  ) => {
    return update({
      _tag: "SetSidebarOpen",
      sidebarOpen,
    });
  };

  const setTheme: AppStateStorageShape["setTheme"] = (theme) => {
    return update({
      _tag: "SetTheme",
      theme,
    });
  };

  return {
    getDungeonRunComparisonGroup,
    getDungeonRunTimeColumns,
    getSelectedConfigurationId,
    getSidebarOpen,
    getTheme,
    setDungeonRunComparisonGroup,
    setDungeonRunTimeColumns,
    setSelectedConfigurationId,
    setSidebarOpen,
    setTheme,
  } satisfies AppStateStorageShape;
});
