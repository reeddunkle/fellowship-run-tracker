import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type EncounterModel } from "@/db/models/encounter-model.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

type GetEncounterByIdOptions = {
  readonly dungeonId: DungeonId;
  readonly id: string;
};

export type EncounterDAOError = SqlError.SqlError | Schema.SchemaError;

export type EncounterDAOShape = {
  readonly getAll: () => E.Effect<
    ReadonlyArray<EncounterModel>,
    EncounterDAOError
  >;

  readonly getById: (
    options: GetEncounterByIdOptions,
  ) => E.Effect<Option.Option<EncounterModel>, EncounterDAOError>;
};

export class EncounterDAO extends Context.Service<
  EncounterDAO,
  EncounterDAOShape
>()("fellowship-run-tracker/db/daos/encounter/encounter-dao/EncounterDAO") {}
