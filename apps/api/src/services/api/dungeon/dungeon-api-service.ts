import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createDungeonApiResponse } from "@frt/api/services/api/dungeon/create-dungeon-api-response.ts";
import {
  DungeonDAO,
  type DungeonDAOError,
} from "@frt/db/daos/dungeon/dungeon-dao.ts";
import {
  type DungeonApiDungeon,
  type DungeonApiDungeonList,
} from "@frt/shared/dungeon/dungeon-api-schema.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

type GetDungeonByIdOptions = {
  readonly id: DungeonId;
};

export type DungeonApiServiceShape = {
  readonly getAll: () => E.Effect<DungeonApiDungeonList, DungeonDAOError>;

  readonly getById: (
    options: GetDungeonByIdOptions,
  ) => E.Effect<Option.Option<DungeonApiDungeon>, DungeonDAOError>;
};

const makeDungeonApiService = E.gen(function* () {
  const dungeonDAO = yield* DungeonDAO;

  const getAll: DungeonApiServiceShape["getAll"] = () => {
    return dungeonDAO.getAll().pipe(
      E.map((dungeons) => {
        return dungeons.map(createDungeonApiResponse);
      }),
    );
  };

  const getById: DungeonApiServiceShape["getById"] = ({ id }) => {
    return dungeonDAO
      .getById({ id })
      .pipe(E.map(Option.map(createDungeonApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies DungeonApiServiceShape;
});

export class DungeonApiService extends Context.Service<
  DungeonApiService,
  DungeonApiServiceShape
>()("@frt/api/services/api/dungeon/dungeon-api-service/DungeonApiService") {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonDAO.layer),
  );
}
