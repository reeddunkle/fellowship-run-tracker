import { useRouter } from "@tanstack/react-router";
import * as E from "effect/Effect";
import * as R from "effect/Record";
import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useMemo,
  useOptimistic,
} from "react";

import * as configurationClient from "@/electron/renderer/api/configuration-client.ts";
import { type DecodedConfigurationEditorValue } from "@/electron/renderer/components/configuration/configuration-form-schema.ts";
import { saveConfigurationApiRequest } from "@/electron/renderer/components/configuration/helpers/configuration-editor-adapter.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { useAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { RouterInvalidationError } from "@/errors/router-invalidation-error.ts";
import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { groupConfigurations } from "./configuration-grouping.ts";
import { reduceConfigurations } from "./configuration-optimistic-state.ts";

type SaveConfigurationActionInput = {
  readonly previousSelectedConfigurationId: ConfigurationId | null;
  readonly value: DecodedConfigurationEditorValue;
};

type UpdateConfigurationActionInput = {
  readonly id: ConfigurationId;
  readonly value: DecodedConfigurationEditorValue;
};

type DeleteConfigurationActionInput = {
  readonly configuration: ConfigurationApiConfiguration;
  readonly previousSelectedConfigurationId: ConfigurationId | null;
};

type ConfigurationPersistenceActionState = {
  readonly configuration: ConfigurationApiConfiguration | undefined;
  readonly error: unknown | undefined;
  readonly revision: number;
};

type ConfigurationDeleteActionState = {
  readonly error: unknown | undefined;
};

function createConfigurationsById(
  configurations: ConfigurationApiConfigurationList,
) {
  return R.fromIterableBy(configurations, (configuration) => {
    return configuration.id;
  });
}

type ConfigurationsById = ReturnType<typeof createConfigurationsById>;

type ConfigurationStateContextValue = {
  readonly configurations: ConfigurationApiConfigurationList;
  readonly configurationsById: ConfigurationsById;
  readonly selectedConfiguration: ConfigurationApiConfiguration | undefined;
  readonly selectedConfigurationId: ConfigurationId | null;
};

type ConfigurationActionContextValue = {
  readonly deleteConfiguration: (id: ConfigurationId) => void;
  readonly deleteError: unknown | undefined;
  readonly error: unknown | undefined;
  readonly isDeleting: boolean;
  readonly isSaving: boolean;
  readonly isUpdating: boolean;
  readonly newConfiguration: () => void;
  readonly save: (value: DecodedConfigurationEditorValue) => void;
  readonly savedConfiguration: ConfigurationApiConfiguration | undefined;
  readonly saveRevision: number;
  readonly selectConfiguration: (id: ConfigurationId) => void;
  readonly update: (
    id: ConfigurationId,
    value: DecodedConfigurationEditorValue,
  ) => void;
  readonly updatedConfiguration: ConfigurationApiConfiguration | undefined;
  readonly updateError: unknown | undefined;
  readonly updateRevision: number;
};

type ConfigurationProviderProps = {
  readonly children: ReactNode;
  readonly configurations: ConfigurationApiConfigurationList;
};

export type ConfigurationLevelGroup = {
  readonly configurations: ConfigurationApiConfigurationList;
  readonly dungeonLevel: ConfigurationApiConfiguration["dungeonLevel"];
};

export type ConfigurationDungeonGroup = {
  readonly dungeonId: ConfigurationApiConfiguration["dungeonId"];
  readonly levels: ReadonlyArray<ConfigurationLevelGroup>;
};

const INITIAL_PERSISTENCE_ACTION_STATE: ConfigurationPersistenceActionState = {
  configuration: undefined,
  error: undefined,
  revision: 0,
};

const INITIAL_DELETE_ACTION_STATE: ConfigurationDeleteActionState = {
  error: undefined,
};

const ConfigurationStateContext = createContext<
  ConfigurationStateContextValue | undefined
>(undefined);

const ConfigurationActionContext = createContext<
  ConfigurationActionContextValue | undefined
>(undefined);

function invalidateRouter(router: ReturnType<typeof useRouter>) {
  return E.tryPromise({
    catch: (cause) => {
      return new RouterInvalidationError({ cause });
    },
    try: () => {
      return router.invalidate({
        sync: true,
      });
    },
  });
}

function invalidateRouterSafely(router: ReturnType<typeof useRouter>) {
  return invalidateRouter(router).pipe(E.ignore);
}

export function ConfigurationProvider({
  children,
  configurations,
}: ConfigurationProviderProps) {
  const router = useRouter();

  const { selectedConfigurationId, setSelectedConfigurationId } = useAppStore();

  const [optimisticConfigurations, updateOptimisticConfigurations] =
    useOptimistic(configurations, reduceConfigurations);

  const configurationsById = useMemo(() => {
    return createConfigurationsById(optimisticConfigurations);
  }, [optimisticConfigurations]);

  const selectedConfiguration =
    selectedConfigurationId === null
      ? undefined
      : configurationsById[selectedConfigurationId];

  const applyPersistedConfiguration = (
    configuration: ConfigurationApiConfiguration,
  ) => {
    return E.sync(() => {
      updateOptimisticConfigurations({
        configuration,
        type: "UPSERT",
      });

      setSelectedConfigurationId(configuration.id);
    });
  };

  const [saveState, dispatchSave, isSaving] = useActionState(
    (
      previousState: ConfigurationPersistenceActionState,
      input: SaveConfigurationActionInput,
    ): Promise<ConfigurationPersistenceActionState> => {
      const request = saveConfigurationApiRequest(input.value);

      return configurationClient
        .saveConfiguration({
          request,
        })
        .pipe(
          E.tap(applyPersistedConfiguration),
          E.tap(() => invalidateRouter(router)),
          E.map((savedConfiguration) => {
            return {
              configuration: savedConfiguration,
              error: undefined,
              revision: previousState.revision + 1,
            };
          }),
          E.catch((error) => {
            return E.gen(function* () {
              yield* E.sync(() => {
                setSelectedConfigurationId(
                  input.previousSelectedConfigurationId,
                );
              });

              yield* invalidateRouterSafely(router);

              return {
                configuration: undefined,
                error,
                revision: previousState.revision,
              };
            });
          }),
          browserRuntime.runPromise,
        );
    },
    INITIAL_PERSISTENCE_ACTION_STATE,
  );

  const [updateState, dispatchUpdate, isUpdating] = useActionState(
    (
      previousState: ConfigurationPersistenceActionState,
      input: UpdateConfigurationActionInput,
    ): Promise<ConfigurationPersistenceActionState> => {
      const request = saveConfigurationApiRequest(input.value);

      return configurationClient
        .updateConfiguration({
          id: input.id,
          request,
        })
        .pipe(
          E.tap(applyPersistedConfiguration),
          E.tap(() => invalidateRouter(router)),
          E.map((updatedConfiguration) => {
            return {
              configuration: updatedConfiguration,
              error: undefined,
              revision: previousState.revision + 1,
            };
          }),
          E.catch((error) => {
            return invalidateRouterSafely(router).pipe(
              E.as({
                configuration: undefined,
                error,
                revision: previousState.revision,
              }),
            );
          }),
          browserRuntime.runPromise,
        );
    },
    INITIAL_PERSISTENCE_ACTION_STATE,
  );

  const [deleteState, dispatchDelete, isDeleting] = useActionState(
    (
      _previousState: ConfigurationDeleteActionState,
      input: DeleteConfigurationActionInput,
    ): Promise<ConfigurationDeleteActionState> => {
      const isSelected =
        input.configuration.id === input.previousSelectedConfigurationId;

      const optimisticallyDeleteConfiguration = E.sync(() => {
        updateOptimisticConfigurations({
          id: input.configuration.id,
          type: "DELETE",
        });

        if (isSelected) {
          setSelectedConfigurationId(null);
        }
      });

      return optimisticallyDeleteConfiguration.pipe(
        E.andThen(
          configurationClient.deleteConfiguration({
            id: input.configuration.id,
          }),
        ),
        E.andThen(invalidateRouter(router)),
        E.as({
          error: undefined,
        }),
        E.catch((error) => {
          return E.gen(function* () {
            yield* E.sync(() => {
              setSelectedConfigurationId(input.previousSelectedConfigurationId);
            });

            yield* invalidateRouterSafely(router);

            return {
              error,
            };
          });
        }),
        browserRuntime.runPromise,
      );
    },
    INITIAL_DELETE_ACTION_STATE,
  );

  const actionContextValue = useMemo<ConfigurationActionContextValue>(() => {
    return {
      deleteConfiguration: (id) => {
        const configuration = configurationsById[id];

        if (configuration === undefined) {
          return;
        }

        startTransition(() => {
          dispatchDelete({
            configuration,
            previousSelectedConfigurationId: selectedConfigurationId,
          });
        });
      },
      deleteError: deleteState.error,
      error: saveState.error,
      isDeleting,
      isSaving,
      isUpdating,
      newConfiguration: () => {
        setSelectedConfigurationId(null);
      },
      save: (value) => {
        startTransition(() => {
          dispatchSave({
            previousSelectedConfigurationId: selectedConfigurationId,
            value,
          });
        });
      },
      savedConfiguration: saveState.configuration,
      saveRevision: saveState.revision,
      selectConfiguration: (id) => {
        setSelectedConfigurationId(id);
      },
      update: (id, value) => {
        startTransition(() => {
          dispatchUpdate({
            id,
            value,
          });
        });
      },
      updatedConfiguration: updateState.configuration,
      updateError: updateState.error,
      updateRevision: updateState.revision,
    };
  }, [
    configurationsById,
    deleteState.error,
    dispatchDelete,
    dispatchSave,
    dispatchUpdate,
    isDeleting,
    isSaving,
    isUpdating,
    saveState.configuration,
    saveState.error,
    saveState.revision,
    selectedConfiguration,
    selectedConfigurationId,
    setSelectedConfigurationId,
    updateState.configuration,
    updateState.error,
    updateState.revision,
  ]);

  const stateContextValue = useMemo<ConfigurationStateContextValue>(() => {
    return {
      configurations: optimisticConfigurations,
      configurationsById,
      selectedConfiguration,
      selectedConfigurationId,
    };
  }, [
    configurationsById,
    optimisticConfigurations,
    selectedConfiguration,
    selectedConfigurationId,
  ]);

  return (
    <ConfigurationActionContext.Provider value={actionContextValue}>
      <ConfigurationStateContext.Provider value={stateContextValue}>
        {children}
      </ConfigurationStateContext.Provider>
    </ConfigurationActionContext.Provider>
  );
}

export function useConfigurationState(): ConfigurationStateContextValue {
  const context = useContext(ConfigurationStateContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useConfigurationState",
      providerName: "ConfigurationProvider",
    });
  }

  return context;
}

export function useConfigurationActions(): ConfigurationActionContextValue {
  const context = useContext(ConfigurationActionContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useConfigurationActions",
      providerName: "ConfigurationProvider",
    });
  }

  return context;
}

export function useConfigurations(): ConfigurationApiConfigurationList {
  return useConfigurationState().configurations;
}

export function useConfigurationGroups(): ReadonlyArray<ConfigurationDungeonGroup> {
  const configurations = useConfigurations();

  return useMemo(() => {
    return groupConfigurations(configurations);
  }, [configurations]);
}

export function useConfigurationById(
  id: ConfigurationId | null | undefined,
): ConfigurationApiConfiguration | undefined {
  const { configurationsById } = useConfigurationState();

  if (id === null || id === undefined) {
    return undefined;
  }

  return configurationsById[id];
}

export function useSelectedConfiguration():
  | ConfigurationApiConfiguration
  | undefined {
  return useConfigurationState().selectedConfiguration;
}

export function useSelectedConfigurationId(): ConfigurationId | null {
  return useConfigurationState().selectedConfigurationId;
}

export type ConfigurationSaveStatus = {
  readonly error: unknown | undefined;
  readonly isSaving: boolean;
  readonly revision: number;
  readonly savedConfiguration: ConfigurationApiConfiguration | undefined;
};

export function useConfigurationSaveStatus(): ConfigurationSaveStatus {
  const { error, isSaving, saveRevision, savedConfiguration } =
    useConfigurationActions();

  return {
    error,
    isSaving,
    revision: saveRevision,
    savedConfiguration,
  };
}

export type ConfigurationUpdateStatus = {
  readonly error: unknown | undefined;
  readonly isUpdating: boolean;
  readonly revision: number;
  readonly updatedConfiguration: ConfigurationApiConfiguration | undefined;
};

export function useConfigurationUpdateStatus(): ConfigurationUpdateStatus {
  const { isUpdating, updateError, updateRevision, updatedConfiguration } =
    useConfigurationActions();

  return {
    error: updateError,
    isUpdating,
    revision: updateRevision,
    updatedConfiguration,
  };
}
