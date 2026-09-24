import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createDungeonApiResponse } from "@frt/api/services/dungeon-catalog/create-dungeon-api-response.ts";
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

export type DungeonCatalogShape = {
  readonly getAll: () => E.Effect<DungeonApiDungeonList, DungeonDAOError>;

  readonly getById: (
    options: GetDungeonByIdOptions,
  ) => E.Effect<Option.Option<DungeonApiDungeon>, DungeonDAOError>;
};

const makeDungeonCatalog = E.gen(function* () {
  const dungeonDAO = yield* DungeonDAO;

  const getAll: DungeonCatalogShape["getAll"] = () => {
    return dungeonDAO.getAll().pipe(
      E.map((dungeons) => {
        return dungeons.map(createDungeonApiResponse);
      }),
    );
  };

  const getById: DungeonCatalogShape["getById"] = ({ id }) => {
    return dungeonDAO
      .getById({ id })
      .pipe(E.map(Option.map(createDungeonApiResponse)));
  };

  return {
    getAll,
    getById,
  } satisfies DungeonCatalogShape;
});

export class DungeonCatalog extends Context.Service<
  DungeonCatalog,
  DungeonCatalogShape
>()(
  "@frt/api/services/dungeon-catalog/dungeon-catalog-service/DungeonCatalog",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonCatalog);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonDAO.layer),
  );
}
