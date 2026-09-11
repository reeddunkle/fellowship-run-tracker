import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  DungeonDAO,
  type DungeonDAOError,
} from "@/db/daos/dungeon/dungeon-dao.ts";
import { createDungeonApiResponse } from "@/services/api/dungeon/create-dungeon-api-response.ts";
import {
  type DungeonApiDungeon,
  type DungeonApiDungeonList,
} from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

type GetDungeonByIdOptions = {
  readonly id: DungeonId;
};

export type DungeonApiServiceShape = {
  readonly getAll: () => E.Effect<DungeonApiDungeonList, DungeonDAOError>;

  readonly getById: (
    options: GetDungeonByIdOptions,
  ) => E.Effect<Option.Option<DungeonApiDungeon>, DungeonDAOError>;
};

export class DungeonApiService extends Context.Service<
  DungeonApiService,
  DungeonApiServiceShape
>()(
  "fellowship-run-tracker/services/api/dungeon/dungeon-api-service/DungeonApiService",
) {}

const make = E.gen(function* () {
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

export const DungeonApiServiceLive = Layer.effect(DungeonApiService, make);
