import * as R from "effect/Record";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
  type SaveConfigurationApiRequest,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

import { useSetSelectedConfigurationId } from "@/renderer/api/app-state/app-state-mutations.ts";
import { useSelectedConfigurationId as useSelectedConfigurationIdQuery } from "@/renderer/api/app-state/app-state-queries.ts";
import {
  useDeleteConfiguration,
  useSaveConfiguration,
  useUpdateConfiguration,
} from "@/renderer/api/configuration/configuration-mutations.ts";
import { useConfigurationsSuspense } from "@/renderer/api/configuration/configuration-queries.ts";

import {
  type ConfigurationDungeonGroup,
  groupConfigurations,
} from "./configuration-groups.ts";

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
  readonly save: (request: SaveConfigurationApiRequest) => void;
  readonly selectConfiguration: (id: ConfigurationId) => void;
  readonly update: (
    id: ConfigurationId,
    request: SaveConfigurationApiRequest,
  ) => void;
  readonly updateError: unknown | undefined;
};

type ConfigurationProviderProps = {
  readonly children: ReactNode;
};

const ConfigurationStateContext = createContext<
  ConfigurationStateContextValue | undefined
>(undefined);

const ConfigurationActionContext = createContext<
  ConfigurationActionContextValue | undefined
>(undefined);

export function ConfigurationProvider({
  children,
}: ConfigurationProviderProps) {
  const configurations = useConfigurationsSuspense();

  const selectedConfigurationId = useSelectedConfigurationIdQuery();
  const setSelectedConfigurationId = useSetSelectedConfigurationId();

  const saveMutation = useSaveConfiguration();

  const updateMutation = useUpdateConfiguration();

  const deleteMutation = useDeleteConfiguration();

  const configurationsById = useMemo(() => {
    return createConfigurationsById(configurations);
  }, [configurations]);

  const selectedConfiguration =
    selectedConfigurationId === null
      ? undefined
      : configurationsById[selectedConfigurationId];

  const actionContextValue = useMemo<ConfigurationActionContextValue>(() => {
    return {
      deleteConfiguration: (id) => {
        const configuration = configurationsById[id];

        if (configuration === undefined) {
          return;
        }

        const previousSelectedConfigurationId = selectedConfigurationId;
        const isSelected = configuration.id === selectedConfigurationId;

        if (isSelected) {
          setSelectedConfigurationId(null);
        }

        deleteMutation.delete(
          {
            id,
          },
          {
            onError: () => {
              setSelectedConfigurationId(previousSelectedConfigurationId);
            },
          },
        );
      },
      deleteError: deleteMutation.error ?? undefined,
      error: saveMutation.error ?? undefined,
      isDeleting: deleteMutation.isPending,
      isSaving: saveMutation.isPending,
      isUpdating: updateMutation.isPending,
      newConfiguration: () => {
        setSelectedConfigurationId(null);
      },
      save: (request) => {
        saveMutation.save(
          {
            request,
          },
          {
            onSuccess: (savedConfiguration) => {
              setSelectedConfigurationId(savedConfiguration.id);
            },
          },
        );
      },
      selectConfiguration: (id) => {
        setSelectedConfigurationId(id);
      },
      update: (id, request) => {
        updateMutation.update(
          {
            id,
            request,
          },
          {
            onSuccess: (updatedConfiguration) => {
              setSelectedConfigurationId(updatedConfiguration.id);
            },
          },
        );
      },
      updateError: updateMutation.error ?? undefined,
    };
  }, [
    configurationsById,
    deleteMutation.error,
    deleteMutation.isPending,
    deleteMutation.delete,
    saveMutation.error,
    saveMutation.isPending,
    saveMutation.save,
    selectedConfigurationId,
    setSelectedConfigurationId,
    updateMutation.error,
    updateMutation.isPending,
    updateMutation.update,
  ]);

  const stateContextValue = useMemo<ConfigurationStateContextValue>(() => {
    return {
      configurations,
      configurationsById,
      selectedConfiguration,
      selectedConfigurationId,
    };
  }, [
    configurations,
    configurationsById,
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

function useConfigurationState(): ConfigurationStateContextValue {
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
