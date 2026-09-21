import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type UnitModel } from "@/db/models/unit-model.ts";

import { makeUnitDAO } from "./make-unit-dao.ts";

type GetUnitByIdOptions = {
  readonly id: string;
};

export type UnitDAOError = SqlError.SqlError | Schema.SchemaError;

export type UnitDAOShape = {
  readonly getAll: () => E.Effect<ReadonlyArray<UnitModel>, UnitDAOError>;

  readonly getById: (
    options: GetUnitByIdOptions,
  ) => E.Effect<Option.Option<UnitModel>, UnitDAOError>;
};

export class UnitDAO extends Context.Service<UnitDAO, UnitDAOShape>()(
  "fellowship-run-tracker/db/daos/unit/unit-dao/UnitDAO",
) {
  static readonly layer = Layer.effect(this, makeUnitDAO);
}
