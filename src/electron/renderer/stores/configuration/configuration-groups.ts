import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Order from "effect/Order";
import * as Record from "effect/Record";

import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
} from "@/services/api/configuration/configuration-api-schema.ts";

export type ConfigurationLevelGroup = {
  readonly configurations: ConfigurationApiConfigurationList;
  readonly dungeonLevel: ConfigurationApiConfiguration["dungeonLevel"];
};

export type ConfigurationDungeonGroup = {
  readonly dungeonId: ConfigurationApiConfiguration["dungeonId"];
  readonly levels: ReadonlyArray<ConfigurationLevelGroup>;
};

export const ConfigurationUpdatedAtAscendingOrder = Order.mapInput(
  Order.Number,
  (configuration: ConfigurationApiConfiguration) => {
    return DateTime.toEpochMillis(configuration.updatedAt);
  },
);

export const ConfigurationUpdatedAtDescendingOrder = Order.flip(
  ConfigurationUpdatedAtAscendingOrder,
);

const ConfigurationDungeonLevelAscendingOrder = Order.mapInput(
  Order.Number,
  (group: ConfigurationLevelGroup) => group.dungeonLevel,
);

export function sortConfigurations(
  configurations: ConfigurationApiConfigurationList,
  order: Order.Order<ConfigurationApiConfiguration>,
): ConfigurationApiConfigurationList {
  return A.sort(configurations, order);
}

export function groupConfigurations(
  configurations: ConfigurationApiConfigurationList,
): ReadonlyArray<ConfigurationDungeonGroup> {
  const configurationsByDungeon = A.groupBy(
    configurations,
    (configuration) => configuration.dungeonId,
  );

  return Record.toEntries(configurationsByDungeon).map(
    ([dungeonId, dungeonConfigurations]) => {
      const configurationsByLevel = A.groupBy(
        dungeonConfigurations,
        (configuration) => String(configuration.dungeonLevel),
      );

      const levels = A.sort(
        Record.toEntries(configurationsByLevel).map(
          ([dungeonLevel, levelConfigurations]) => {
            return {
              configurations: sortConfigurations(
                levelConfigurations,
                ConfigurationUpdatedAtDescendingOrder,
              ),
              dungeonLevel: Number(dungeonLevel),
            } satisfies ConfigurationLevelGroup;
          },
        ),
        ConfigurationDungeonLevelAscendingOrder,
      );

      return {
        dungeonId,
        levels,
      } satisfies ConfigurationDungeonGroup;
    },
  );
}
