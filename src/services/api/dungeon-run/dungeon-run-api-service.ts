import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type ConfigurationDAOError } from "@/errors/configuration-dao-error.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { createDungeonRunApiResponse } from "@/services/api/dungeon-run/create-dungeon-run-api-response.ts";
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type DeleteDungeonRunHistoryOptions = {
  readonly configurationId: ConfigurationId;
};

type GetDungeonRunHistoryOptions = {
  readonly configurationId: ConfigurationId;
};

export type DungeonRunApiServiceError =
  | ConfigurationDAOError
  | DungeonRunDAOError
  | DungeonRunObservationDAOError;

export type DungeonRunApiServiceShape = {
  readonly deleteHistory: (
    options: DeleteDungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunApiServiceError>;

  readonly getHistory: (
    options: GetDungeonRunHistoryOptions,
  ) => E.Effect<Option.Option<DungeonRunApiHistory>, DungeonRunApiServiceError>;
};

export class DungeonRunApiService extends Context.Service<
  DungeonRunApiService,
  DungeonRunApiServiceShape
>()(
  "fellowship-run-tracker/services/api/dungeon-run/dungeon-run-api-service/DungeonRunApiService",
) {}

const make = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

  const deleteHistory: DungeonRunApiServiceShape["deleteHistory"] = ({
    configurationId,
  }) => {
    return E.gen(function* () {
      const configuration = yield* configurationDAO.getById({
        id: configurationId,
      });

      if (Option.isNone(configuration)) {
        return;
      }

      yield* dungeonRunDAO.deleteHistoryByConfigurationDefinitionId({
        configurationDefinitionId:
          configuration.value.configurationDefinitionId,
      });
    });
  };

  const getHistory: DungeonRunApiServiceShape["getHistory"] = ({
    configurationId,
  }) => {
    return E.gen(function* () {
      const configuration = yield* configurationDAO.getById({
        id: configurationId,
      });

      if (Option.isNone(configuration)) {
        return Option.none<DungeonRunApiHistory>();
      }

      const observations =
        yield* dungeonRunObservationDAO.getHistoryByConfigurationDefinitionId({
          configurationDefinitionId:
            configuration.value.configurationDefinitionId,
        });

      return Option.some(
        createDungeonRunApiResponse({
          configurationId,
          observations,
        }),
      );
    });
  };

  return {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunApiServiceShape;
});

export const DungeonRunApiServiceLive = Layer.effect(
  DungeonRunApiService,
  make,
);
