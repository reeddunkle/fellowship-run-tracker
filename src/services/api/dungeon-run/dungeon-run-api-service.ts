import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { type DungeonRunApiHistory } from "@/contracts/dungeon-run/dungeon-run-api-schema.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { DungeonRunApiResponseError } from "@/errors/dungeon-run-api-service-error.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { createDungeonRunApiResponse } from "@/services/api/dungeon-run/create-dungeon-run-api-response.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";

type DungeonRunHistoryOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

export type DungeonRunApiServiceError =
  | DungeonRunApiResponseError
  | DungeonRunObservationDAOError
  | DungeonRunRepositoryError;

export type DungeonRunApiServiceShape = {
  readonly deleteHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunApiServiceError>;

  readonly getHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<DungeonRunApiHistory, DungeonRunApiServiceError>;
};

const makeDungeonRunApiService = E.gen(function* () {
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const dungeonRunRepository = yield* DungeonRunRepository;

  const deleteHistory: DungeonRunApiServiceShape["deleteHistory"] = ({
    dungeonId,
    dungeonLevel,
  }) => {
    return dungeonRunRepository.deleteHistory({
      dungeonId,
      dungeonLevel,
    });
  };

  const getHistory: DungeonRunApiServiceShape["getHistory"] = ({
    dungeonId,
    dungeonLevel,
  }) => {
    return E.gen(function* () {
      const observations = yield* dungeonRunObservationDAO.getHistoryByDungeon({
        dungeonId,
        dungeonLevel,
      });

      return yield* createDungeonRunApiResponse({
        observations,
      }).pipe(
        E.mapError((cause) => {
          return new DungeonRunApiResponseError({
            cause,
            message: "Failed to create dungeon run history response.",
          });
        }),
      );
    });
  };

  return {
    deleteHistory,
    getHistory,
  } satisfies DungeonRunApiServiceShape;
});

export class DungeonRunApiService extends Context.Service<
  DungeonRunApiService,
  DungeonRunApiServiceShape
>()(
  "fellowship-run-tracker/services/api/dungeon-run/dungeon-run-api-service/DungeonRunApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
  );
}
