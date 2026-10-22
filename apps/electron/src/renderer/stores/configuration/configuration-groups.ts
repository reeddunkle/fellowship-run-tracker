import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Order from "effect/Order";
import * as Record from "effect/Record";

import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
} from "@frt/shared/configuration/configuration-api-schema.ts";

type ConfigurationLevelGroup = {
  readonly adventureDifficulty: ConfigurationApiConfiguration["adventureDifficulty"];
  readonly configurations: ConfigurationApiConfigurationList;
  readonly dungeonCategory: ConfigurationApiConfiguration["dungeonCategory"];
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

function sortConfigurations(
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
        (configuration) => {
          return [
            configuration.dungeonCategory ?? "ETERNAL",
            configuration.adventureDifficulty ?? "",
            configuration.dungeonLevel,
          ].join(":");
        },
      );

      const levels = A.sort(
        Record.toEntries(configurationsByLevel).map(
          ([, levelConfigurations]) => {
            const firstConfiguration = levelConfigurations[0];

            if (firstConfiguration === undefined) {
              throw new Error("Expected a configuration level group.");
            }

            return {
              adventureDifficulty: firstConfiguration.adventureDifficulty,
              configurations: sortConfigurations(
                levelConfigurations,
                ConfigurationUpdatedAtDescendingOrder,
              ),
              dungeonCategory: firstConfiguration.dungeonCategory,
              dungeonLevel: firstConfiguration.dungeonLevel,
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
