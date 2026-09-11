import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { FELLOWSHIP_DUNGEON } from "@/catalogs/dungeons/fellowship-dungeons-catalog.ts";

export const seedDungeonTable = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = DateTime.toEpochMillis(yield* DateTime.now);

  for (const dungeon of Object.values(FELLOWSHIP_DUNGEON)) {
    yield* sql`
      INSERT INTO
        dungeon (id, map_id, name, created_at, updated_at)
      VALUES
        (
          ${dungeon.dungeonId},
          ${dungeon.mapId},
          ${dungeon.name},
          ${now},
          ${now}
        )
    `;
  }
});
