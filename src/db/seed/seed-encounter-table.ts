import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { FELLOWSHIP_ENCOUNTER } from "@/catalogs/encounters/fellowship-encounters-catalog.ts";

export const seedEncounterTable = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = DateTime.toEpochMillis(yield* DateTime.now);

  for (const encounter of Object.values(FELLOWSHIP_ENCOUNTER)) {
    yield* sql`
      INSERT INTO
        encounter (dungeon_id, id, name, created_at, updated_at)
      VALUES
        (
          ${encounter.dungeonId},
          ${encounter.encounterId},
          ${encounter.name},
          ${now},
          ${now}
        )
    `;
  }
});
