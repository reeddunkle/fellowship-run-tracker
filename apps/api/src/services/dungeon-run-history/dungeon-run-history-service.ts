import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { DungeonRunApiResponseError } from "@frt/api/errors/dungeon-run-api-response-error.ts";
import { createDungeonRunApiResponse } from "@frt/api/services/dungeon-run-history/create-dungeon-run-api-response.ts";
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

export type DungeonRunHistoryError =
  | DungeonRunApiResponseError
  | DungeonRunObservationDAOError
  | DungeonRunRepositoryError;

export type DungeonRunHistoryShape = {
  readonly deleteHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunHistoryError>;

  readonly getHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<DungeonRunApiHistory, DungeonRunHistoryError>;
};

const makeDungeonRunHistory = E.gen(function* () {
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;
  const dungeonRunRepository = yield* DungeonRunRepository;

  const deleteHistory: DungeonRunHistoryShape["deleteHistory"] = ({
    dungeonId,
    dungeonLevel,
  }) => {
    return dungeonRunRepository.deleteHistory({
      dungeonId,
      dungeonLevel,
    });
  };

  const getHistory: DungeonRunHistoryShape["getHistory"] = ({
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
  } satisfies DungeonRunHistoryShape;
});

export class DungeonRunHistory extends Context.Service<
  DungeonRunHistory,
  DungeonRunHistoryShape
>()(
  "@frt/api/services/dungeon-run-history/dungeon-run-history-service/DungeonRunHistory",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunHistory);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
  );
}
