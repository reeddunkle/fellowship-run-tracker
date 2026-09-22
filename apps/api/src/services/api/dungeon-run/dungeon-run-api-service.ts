import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { DungeonRunApiResponseError } from "@frt/api/errors/dungeon-run-api-response-error.ts";
import { createDungeonRunApiResponse } from "@frt/api/services/api/dungeon-run/create-dungeon-run-api-response.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { type DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { type DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import { type DungeonRunApiHistory } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";

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
  "@frt/api/services/api/dungeon-run/dungeon-run-api-service/DungeonRunApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
  );
}
