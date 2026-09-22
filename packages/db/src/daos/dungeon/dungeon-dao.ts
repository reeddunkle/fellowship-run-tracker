import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type DungeonModel } from "@frt/db/models/dungeon-model.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { makeDungeonDAO } from "./make-dungeon-dao.ts";

type GetDungeonByIdOptions = {
  readonly id: DungeonId;
};

export type DungeonDAOError = SqlError.SqlError | Schema.SchemaError;

export type DungeonDAOShape = {
  readonly getAll: () => E.Effect<ReadonlyArray<DungeonModel>, DungeonDAOError>;

  readonly getById: (
    options: GetDungeonByIdOptions,
  ) => E.Effect<Option.Option<DungeonModel>, DungeonDAOError>;
};

export class DungeonDAO extends Context.Service<DungeonDAO, DungeonDAOShape>()(
  "@frt/db/daos/dungeon/dungeon-dao/DungeonDAO",
) {
  static readonly layer = Layer.effect(this, makeDungeonDAO);
}
