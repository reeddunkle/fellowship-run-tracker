import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type DungeonModel } from "@/db/models/dungeon-model.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

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
  "fellowship-run-tracker/db/daos/dungeon/dungeon-dao/DungeonDAO",
) {}
