import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { UnitModel, UnitStatusSchema } from "@/db/models/unit-model.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

import { UnitDAO, type UnitDAOShape } from "./unit-dao.ts";

const UnitRowSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtcFromMillis,
  dungeonId: Schema.NullOr(NonEmptyStringSchema),
  groupKey: Schema.NullOr(NonEmptyStringSchema),
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: UnitStatusSchema,
  updatedAt: Schema.DateTimeUtcFromMillis,
  variant: Schema.NullOr(NonEmptyStringSchema),
});

type UnitRow = typeof UnitRowSchema.Type;

function decodeUnitRows(
  rows: unknown,
): E.Effect<ReadonlyArray<UnitRow>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(UnitRowSchema))(rows);
}

function createUnitModels(
  rows: ReadonlyArray<UnitRow>,
): ReadonlyArray<UnitModel> {
  const unitsById = rows.reduce(
    (accumulator, row) => {
      const existingUnit = accumulator.get(row.id);

      if (existingUnit !== undefined) {
        if (row.dungeonId !== null) {
          existingUnit.dungeonIds.push(row.dungeonId);
        }

        return accumulator;
      }

      accumulator.set(row.id, {
        createdAt: row.createdAt,
        dungeonIds: row.dungeonId === null ? [] : [row.dungeonId],
        groupKey: row.groupKey,
        id: row.id,
        name: row.name,
        status: row.status,
        updatedAt: row.updatedAt,
        variant: row.variant,
      });

      return accumulator;
    },
    new Map<
      string,
      {
        createdAt: UnitRow["createdAt"];
        dungeonIds: Array<string>;
        groupKey: string | null;
        id: string;
        name: string;
        status: UnitRow["status"];
        updatedAt: UnitRow["updatedAt"];
        variant: string | null;
      }
    >(),
  );

  return Array.from(unitsById.values()).map((unit) => {
    return new UnitModel(unit);
  });
}

const make = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getAll: UnitDAOShape["getAll"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          unit.created_at AS createdAt,
          unit.id,
          unit.group_key AS groupKey,
          unit.name,
          unit.status,
          unit.updated_at AS updatedAt,
          unit.variant,
          dungeon_unit.dungeon_id AS dungeonId
        FROM
          unit
          LEFT JOIN dungeon_unit ON dungeon_unit.unit_id = unit.id
        WHERE
          unit.status = 'ACTIVE'
        ORDER BY
          unit.name
      `;

      const unitRows = yield* decodeUnitRows(rows);

      return createUnitModels(unitRows);
    });
  };

  const getById: UnitDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          unit.created_at AS createdAt,
          unit.id,
          unit.group_key AS groupKey,
          unit.name,
          unit.status,
          unit.updated_at AS updatedAt,
          unit.variant,
          dungeon_unit.dungeon_id AS dungeonId
        FROM
          unit
          LEFT JOIN dungeon_unit ON dungeon_unit.unit_id = unit.id
        WHERE
          unit.id = ${id}
          AND unit.status = 'ACTIVE'
      `;

      const unitRows = yield* decodeUnitRows(rows);
      const unit = createUnitModels(unitRows)[0];

      return unit === undefined ? Option.none<UnitModel>() : Option.some(unit);
    });
  };

  return {
    getAll,
    getById,
  } satisfies UnitDAOShape;
});

export const UnitDAOLive = Layer.effect(UnitDAO, make);
