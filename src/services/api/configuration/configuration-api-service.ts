import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { type ConfigurationDAOError } from "@/errors/configuration-dao-error.ts";
import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiConfigurationList,
  type DeleteConfigurationsByDungeonAndLevelApiRequest,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { createConfigurationApiResponse } from "@/services/api/configuration/create-configuration-api-response.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type ConfigurationLabel } from "@/validation/configuration/configuration-label-schema.ts";

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

export type ConfigurationApiServiceShape = {
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

export class ConfigurationApiService extends Context.Service<
  ConfigurationApiService,
  ConfigurationApiServiceShape
>()(
  "fellowship-run-tracker/services/api/configuration/configuration-api-service/ConfigurationApiService",
) {}

const make = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;

  const deleteConfiguration: ConfigurationApiServiceShape["delete"] = ({
    id,
  }) => {
    return configurationDAO.delete({ id });
  };

  const deleteByDungeonAndLevel: ConfigurationApiServiceShape["deleteByDungeonAndLevel"] =
    ({ dungeonId, dungeonLevel }) => {
      return configurationDAO.deleteByDungeonAndLevel({
        dungeonId,
        dungeonLevel,
      });
    };

  const getAll: ConfigurationApiServiceShape["getAll"] = () => {
    return configurationDAO.getAll().pipe(
      E.map((configurations) => {
        return configurations.map(createConfigurationApiResponse);
      }),
    );
  };

  const getById: ConfigurationApiServiceShape["getById"] = ({ id }) => {
    return configurationDAO
      .getById({ id })
      .pipe(E.map(Option.map(createConfigurationApiResponse)));
  };

  const save: ConfigurationApiServiceShape["save"] = ({
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

  const saveReplacingDungeonAndLevel: ConfigurationApiServiceShape["saveReplacingDungeonAndLevel"] =
    ({ configuration, label }) => {
      return configurationDAO
        .saveReplacingDungeonAndLevel({
          configuration,
          label,
        })
        .pipe(E.map(createConfigurationApiResponse));
    };

  const update: ConfigurationApiServiceShape["update"] = ({
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
  } satisfies ConfigurationApiServiceShape;
});

export const ConfigurationApiServiceLive = Layer.effect(
  ConfigurationApiService,
  make,
);
