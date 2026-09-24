import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createConfigurationApiResponse } from "@frt/api/services/configuration-library/create-configuration-api-response.ts";
import { ConfigurationDAO } from "@frt/db/daos/configuration/configuration-dao.ts";
import { type ConfigurationDAOError } from "@frt/db/errors/configuration-dao-error.ts";
import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
  type DeleteConfigurationsByDungeonAndLevelApiRequest,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import { type ConfigurationLabel } from "@frt/shared/configuration/configuration-label-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

type SaveConfigurationOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly label: ConfigurationLabel;
};

type UpdateConfigurationOptions = SaveConfigurationOptions & {
  readonly id: ConfigurationId;
};

type DeleteConfigurationOptions = {
  readonly id: ConfigurationId;
};

type GetConfigurationByIdOptions = {
  readonly id: ConfigurationId;
};

export type ConfigurationLibraryShape = {
  readonly delete: (
    options: DeleteConfigurationOptions,
  ) => E.Effect<void, ConfigurationDAOError>;

  readonly deleteByDungeonAndLevel: (
    options: DeleteConfigurationsByDungeonAndLevelApiRequest,
  ) => E.Effect<void, ConfigurationDAOError>;

  readonly getAll: () => E.Effect<
    ConfigurationApiConfigurationList,
    ConfigurationDAOError
  >;

  readonly getById: (
    options: GetConfigurationByIdOptions,
  ) => E.Effect<
    Option.Option<ConfigurationApiConfiguration>,
    ConfigurationDAOError
  >;

  readonly save: (
    options: SaveConfigurationOptions,
  ) => E.Effect<ConfigurationApiConfiguration, ConfigurationDAOError>;

  readonly saveReplacingDungeonAndLevel: (
    options: SaveConfigurationOptions,
  ) => E.Effect<ConfigurationApiConfiguration, ConfigurationDAOError>;

  readonly update: (
    options: UpdateConfigurationOptions,
  ) => E.Effect<ConfigurationApiConfiguration, ConfigurationDAOError>;
};

const makeConfigurationLibrary = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;

  const deleteConfiguration: ConfigurationLibraryShape["delete"] = ({ id }) => {
    return configurationDAO.delete({ id });
  };

  const deleteByDungeonAndLevel: ConfigurationLibraryShape["deleteByDungeonAndLevel"] =
    ({ dungeonId, dungeonLevel }) => {
      return configurationDAO.deleteByDungeonAndLevel({
        dungeonId,
        dungeonLevel,
      });
    };

  const getAll: ConfigurationLibraryShape["getAll"] = () => {
    return configurationDAO.getAll().pipe(
      E.map((configurations) => {
        return configurations.map(createConfigurationApiResponse);
      }),
    );
  };

  const getById: ConfigurationLibraryShape["getById"] = ({ id }) => {
    return configurationDAO
      .getById({ id })
      .pipe(E.map(Option.map(createConfigurationApiResponse)));
  };

  const save: ConfigurationLibraryShape["save"] = ({
    configuration,
    label,
  }) => {
    return configurationDAO
      .save({
        configuration,
        label,
      })
      .pipe(E.map(createConfigurationApiResponse));
  };

  const saveReplacingDungeonAndLevel: ConfigurationLibraryShape["saveReplacingDungeonAndLevel"] =
    ({ configuration, label }) => {
      return configurationDAO
        .saveReplacingDungeonAndLevel({
          configuration,
          label,
        })
        .pipe(E.map(createConfigurationApiResponse));
    };

  const update: ConfigurationLibraryShape["update"] = ({
    configuration,
    id,
    label,
  }) => {
    return configurationDAO
      .update({
        configuration,
        id,
        label,
      })
      .pipe(E.map(createConfigurationApiResponse));
  };

  return {
    delete: deleteConfiguration,
    deleteByDungeonAndLevel,
    getAll,
    getById,
    save,
    saveReplacingDungeonAndLevel,
    update,
  } satisfies ConfigurationLibraryShape;
});

export class ConfigurationLibrary extends Context.Service<
  ConfigurationLibrary,
  ConfigurationLibraryShape
>()(
  "@frt/api/services/configuration-library/configuration-library-service/ConfigurationLibrary",
) {
  static readonly layerNoDeps = Layer.effect(this, makeConfigurationLibrary);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(ConfigurationDAO.layer),
  );
}
