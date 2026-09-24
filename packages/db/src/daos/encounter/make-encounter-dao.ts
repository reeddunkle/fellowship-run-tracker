import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { EncounterModel } from "@frt/db/models/encounter-model.ts";

import { type EncounterDAOShape } from "./encounter-dao.ts";

function decodeEncounterRows(
  rows: unknown,
): E.Effect<ReadonlyArray<EncounterModel>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(EncounterModel))(rows);
}

export const makeEncounterDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const getAll: EncounterDAOShape["getAll"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          created_at AS createdAt,
          dungeon_id AS dungeonId,
          id,
          name,
          updated_at AS updatedAt
        FROM
          encounter
        ORDER BY
          id
      `;

      return yield* decodeEncounterRows(rows);
    });
  };

  const getById: EncounterDAOShape["getById"] = ({ dungeonId, id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          created_at AS createdAt,
          dungeon_id AS dungeonId,
          id,
          name,
          updated_at AS updatedAt
        FROM
          encounter
        WHERE
          dungeon_id = ${dungeonId}
          AND id = ${id}
        LIMIT
          1
      `;

      const encounters = yield* decodeEncounterRows(rows);
      const encounter = encounters[0];

      return encounter === undefined
        ? Option.none<EncounterModel>()
        : Option.some(encounter);
    });
  };

  return {
    getAll,
    getById,
  } satisfies EncounterDAOShape;
});
