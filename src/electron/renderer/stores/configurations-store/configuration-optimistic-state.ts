import * as Match from "effect/Match";

import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

export type ConfigurationOptimisticAction =
  | {
      readonly configuration: ConfigurationApiConfiguration;
      readonly type: "UPSERT";
    }
  | {
      readonly id: ConfigurationId;
      readonly type: "DELETE";
    };

export function reduceConfigurations(
  configurations: ConfigurationApiConfigurationList,
  action: ConfigurationOptimisticAction,
): ConfigurationApiConfigurationList {
  return Match.value(action).pipe(
    Match.when({ type: "DELETE" }, ({ id }) => {
      return configurations.filter((configuration) => {
        return configuration.id !== id;
      });
    }),
    Match.when({ type: "UPSERT" }, ({ configuration }) => {
      const exists = configurations.some((candidate) => {
        return candidate.id === configuration.id;
      });

      if (!exists) {
        return [...configurations, configuration];
      }

      return configurations.map((candidate) => {
        return candidate.id === configuration.id ? configuration : candidate;
      });
    }),
    Match.exhaustive,
  );
}
