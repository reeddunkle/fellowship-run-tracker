import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as A from "effect/Array";
import * as E from "effect/Effect";

import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
  type ConfigurationApiMilestone,
  type ConfigurationApiRequirement,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import {
  type FellowshipMilestoneDefinition,
  type FellowshipRequirement,
} from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";

import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import {
  type ConfigurationIdArgs,
  deleteConfiguration,
  type SaveConfigurationArgs,
  saveConfiguration,
  type UpdateConfigurationArgs,
  updateConfiguration,
} from "@/renderer/api/configuration/configuration-client.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import { getConfigurationsQueryOptions } from "./configuration-queries.ts";

type ConfigurationsMutationContext = {
  readonly previousConfigurations:
    | ConfigurationApiConfigurationList
    | undefined;
};

function getConfigurationsQueryKey() {
  return getConfigurationsQueryOptions().queryKey;
}

function replaceConfiguration(
  configurations: ConfigurationApiConfigurationList,
  configuration: ConfigurationApiConfiguration,
): ConfigurationApiConfigurationList {
  const exists = configurations.some((candidate) => {
    return candidate.id === configuration.id;
  });

  if (!exists) {
    return [...configurations, configuration];
  }

  return configurations.map((candidate) => {
    return candidate.id === configuration.id ? configuration : candidate;
  });
}

function setConfiguration(
  queryClient: QueryClient,
  configuration: ConfigurationApiConfiguration,
): void {
  queryClient.setQueryData<ConfigurationApiConfigurationList | undefined>(
    getConfigurationsQueryKey(),
    (configurations) => {
      if (configurations === undefined) {
        return configurations;
      }

      return replaceConfiguration(configurations, configuration);
    },
  );
}

function snapshotConfigurations(
  queryClient: QueryClient,
): E.Effect<ConfigurationsMutationContext, unknown> {
  return E.gen(function* () {
    yield* E.tryPromise({
      catch: (cause) => {
        return new QueryClientOperationError({
          cause,
          operation: "CancelQueries",
        });
      },
      try: () => {
        return queryClient.cancelQueries({
          queryKey: getConfigurationsQueryKey(),
        });
      },
    });

    return {
      previousConfigurations:
        queryClient.getQueryData<ConfigurationApiConfigurationList>(
          getConfigurationsQueryKey(),
        ),
    };
  });
}

function rollbackConfigurations(
  queryClient: QueryClient,
  context: ConfigurationsMutationContext | undefined,
): void {
  if (context === undefined) {
    return;
  }

  queryClient.setQueryData<ConfigurationApiConfigurationList | undefined>(
    getConfigurationsQueryKey(),
    context.previousConfigurations,
  );
}

function invalidateConfigurations(
  queryClient: QueryClient,
): E.Effect<void, unknown> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "InvalidateQueries",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({
        queryKey: getConfigurationsQueryKey(),
      });
    },
  });
}

function getRequirementTargetId(requirement: FellowshipRequirement): string {
  if ("abilityId" in requirement) {
    return requirement.abilityId;
  }

  if ("encounterId" in requirement) {
    return requirement.encounterId;
  }

  if ("unitTypeId" in requirement) {
    return requirement.unitTypeId;
  }

  return requirement.type;
}

function toConfigurationApiRequirement(
  requirement: FellowshipRequirement,
): ConfigurationApiRequirement {
  return {
    requiredCount: requirement.requiredCount,
    startOccurrence: requirement.startOccurrence,
    targetId: getRequirementTargetId(requirement),
    type: requirement.type,
  };
}

function toConfigurationApiMilestone(
  milestone: FellowshipMilestoneDefinition,
): ConfigurationApiMilestone {
  return {
    comparisonTime: milestone.comparisonTime,
    label: milestone.label,
    requirements: A.map(milestone.requirements, (requirement) => {
      return toConfigurationApiRequirement(requirement);
    }),
  };
}

function applyOptimisticConfigurationUpdate(
  configuration: ConfigurationApiConfiguration,
  args: UpdateConfigurationArgs,
): ConfigurationApiConfiguration {
  return {
    ...configuration,
    dungeonId: args.request.configuration.dungeonId,
    dungeonLevel: args.request.configuration.dungeonLevel,
    label: args.request.label,
    milestones: args.request.configuration.milestones.map((milestone) => {
      return toConfigurationApiMilestone(milestone);
    }),
  };
}

function saveConfigurationMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (args: SaveConfigurationArgs) => {
      return browserRuntime.runPromise(saveConfiguration(args));
    },
    mutationKey: ["configurations", "save"],
    onSettled: () => {
      return browserRuntime.runPromise(invalidateConfigurations(queryClient));
    },
    onSuccess: (savedConfiguration) => {
      setConfiguration(queryClient, savedConfiguration);
    },
  });
}

function updateConfigurationMutationOptions(queryClient: QueryClient) {
  return mutationOptions<
    ConfigurationApiConfiguration,
    unknown,
    UpdateConfigurationArgs,
    ConfigurationsMutationContext
  >({
    mutationFn: (args) => {
      return browserRuntime.runPromise(updateConfiguration(args));
    },
    mutationKey: ["configurations", "update"],
    onError: (_error, _args, context) => {
      rollbackConfigurations(queryClient, context);
    },
    onMutate: (args) => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          const context = yield* snapshotConfigurations(queryClient);

          queryClient.setQueryData<
            ConfigurationApiConfigurationList | undefined
          >(getConfigurationsQueryKey(), (configurations) => {
            if (configurations === undefined) {
              return configurations;
            }

            return configurations.map((configuration) => {
              if (configuration.id !== args.id) {
                return configuration;
              }

              return applyOptimisticConfigurationUpdate(configuration, args);
            });
          });

          return context;
        }),
      );
    },
    onSettled: () => {
      return browserRuntime.runPromise(invalidateConfigurations(queryClient));
    },
    onSuccess: (updatedConfiguration) => {
      setConfiguration(queryClient, updatedConfiguration);
    },
  });
}

function deleteConfigurationMutationOptions(queryClient: QueryClient) {
  return mutationOptions<
    void,
    unknown,
    ConfigurationIdArgs,
    ConfigurationsMutationContext
  >({
    mutationFn: (args) => {
      return browserRuntime.runPromise(deleteConfiguration(args));
    },
    mutationKey: ["configurations", "delete"],
    onError: (_error, _args, context) => {
      rollbackConfigurations(queryClient, context);
    },
    onMutate: (args) => {
      return browserRuntime.runPromise(
        E.gen(function* () {
          const context = yield* snapshotConfigurations(queryClient);

          queryClient.setQueryData<
            ConfigurationApiConfigurationList | undefined
          >(getConfigurationsQueryKey(), (configurations) => {
            if (configurations === undefined) {
              return configurations;
            }

            return configurations.filter((configuration) => {
              return configuration.id !== args.id;
            });
          });

          return context;
        }),
      );
    },
    onSettled: () => {
      return browserRuntime.runPromise(invalidateConfigurations(queryClient));
    },
  });
}

export function useSaveConfiguration() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending } = useMutation(
    saveConfigurationMutationOptions(queryClient),
  );
  return { error, isPending, save: mutate };
}

export function useUpdateConfiguration() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending } = useMutation(
    updateConfigurationMutationOptions(queryClient),
  );
  return { error, isPending, update: mutate };
}

export function useDeleteConfiguration() {
  const queryClient = useQueryClient();
  const { mutate, error, isPending } = useMutation(
    deleteConfigurationMutationOptions(queryClient),
  );
  return { delete: mutate, error, isPending };
}
