import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";

import { makeConfigurationDAO } from "@frt/db/daos/configuration/make-configuration-dao.ts";
import { type ConfigurationDAOError } from "@frt/db/errors/configuration-dao-error.ts";
import { type ConfigurationModel } from "@frt/db/models/configuration-model.ts";
import { type ConfigurationDefinitionId } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type ConfigurationFingerprint } from "@frt/shared/validation/configuration/configuration-fingerprint-schema.ts";
import { type ConfigurationId } from "@frt/shared/validation/configuration/configuration-id-schema.ts";
import { type ConfigurationLabel } from "@frt/shared/validation/configuration/configuration-label-schema.ts";

export type PersistedConfiguration = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly configurationDefinitionId: ConfigurationDefinitionId;
  readonly createdAt: ConfigurationModel["createdAt"];
  readonly fingerprint: ConfigurationFingerprint;
  readonly id: ConfigurationId;
  readonly label: ConfigurationLabel;
  readonly updatedAt: ConfigurationModel["updatedAt"];
};

type SaveConfigurationOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly label: ConfigurationLabel;
};

type UpdateConfigurationOptions = SaveConfigurationOptions & {
  readonly id: ConfigurationId;
};

type GetConfigurationByIdOptions = {
  readonly id: ConfigurationId;
};

type DeleteConfigurationOptions = {
  readonly id: ConfigurationId;
};

type DeleteConfigurationsByDungeonAndLevelOptions = {
  readonly dungeonId: FellowshipMilestoneConfiguration["dungeonId"];
  readonly dungeonLevel: FellowshipMilestoneConfiguration["dungeonLevel"];
};

export type ConfigurationDAOShape = {
  readonly delete: (
    options: DeleteConfigurationOptions,
  ) => E.Effect<void, ConfigurationDAOError>;

  readonly deleteByDungeonAndLevel: (
    options: DeleteConfigurationsByDungeonAndLevelOptions,
  ) => E.Effect<void, ConfigurationDAOError>;

  readonly getAll: () => E.Effect<
    ReadonlyArray<PersistedConfiguration>,
    ConfigurationDAOError
  >;

  readonly getById: (
    options: GetConfigurationByIdOptions,
  ) => E.Effect<Option.Option<PersistedConfiguration>, ConfigurationDAOError>;

  readonly save: (
    options: SaveConfigurationOptions,
  ) => E.Effect<PersistedConfiguration, ConfigurationDAOError>;

  readonly saveReplacingDungeonAndLevel: (
    options: SaveConfigurationOptions,
  ) => E.Effect<PersistedConfiguration, ConfigurationDAOError>;

  readonly update: (
    options: UpdateConfigurationOptions,
  ) => E.Effect<PersistedConfiguration, ConfigurationDAOError>;
};

export class ConfigurationDAO extends Context.Service<
  ConfigurationDAO,
  ConfigurationDAOShape
>()("@frt/db/daos/configuration/configuration-dao/ConfigurationDAO") {
  static readonly layer = Layer.effect(this, makeConfigurationDAO);
}
