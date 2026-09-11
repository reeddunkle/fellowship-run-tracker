import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type ConfigurationDAOError } from "@/errors/configuration-dao-error.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { createDungeonRunApiResponse } from "@/services/api/dungeon-run/create-dungeon-run-api-response.ts";
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type GetDungeonRunHistoryOptions = {
  readonly configurationId: ConfigurationId;
};

export type DungeonRunApiServiceError =
  | ConfigurationDAOError
  | DungeonRunObservationDAOError;

export type DungeonRunApiServiceShape = {
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
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

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
    getHistory,
  } satisfies DungeonRunApiServiceShape;
});

export const DungeonRunApiServiceLive = Layer.effect(
  DungeonRunApiService,
  make,
);
