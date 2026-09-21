import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { DungeonModel } from "@/db/models/dungeon-model.ts";

import { type DungeonDAOShape } from "./dungeon-dao.ts";

function decodeDungeonRows(
  rows: unknown,
): E.Effect<ReadonlyArray<DungeonModel>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(DungeonModel))(rows);
}

export const makeDungeonDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getAll: DungeonDAOShape["getAll"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          created_at AS createdAt,
          id,
          map_id AS mapId,
          name,
          updated_at AS updatedAt
        FROM
          dungeon
        ORDER BY
          name
      `;

      return yield* decodeDungeonRows(rows);
    });
  };

  const getById: DungeonDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          created_at AS createdAt,
          id,
          map_id AS mapId,
          name,
          updated_at AS updatedAt
        FROM
          dungeon
        WHERE
          id = ${id}
        LIMIT
          1
      `;

      const dungeons = yield* decodeDungeonRows(rows);
      const dungeon = dungeons[0];

      return dungeon === undefined
        ? Option.none<DungeonModel>()
        : Option.some(dungeon);
    });
  };

  return {
    getAll,
    getById,
  } satisfies DungeonDAOShape;
});
