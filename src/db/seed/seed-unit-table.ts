import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { loadFellowshipUnitCatalog } from "@/catalogs/units/load-fellowship-unit-catalog.ts";

export const seedUnitTable = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const catalog = yield* loadFellowshipUnitCatalog();
  const now = DateTime.toEpochMillis(yield* DateTime.now);

  for (const unit of catalog) {
    yield* sql`
      INSERT INTO
        unit (
          id,
          group_key,
          name,
          status,
          variant,
          created_at,
          updated_at
        )
      VALUES
        (
          ${unit.id},
          ${unit.groupKey},
          ${unit.name},
          ${unit.status},
          ${unit.variant},
          ${now},
          ${now}
        )
    `;

    for (const dungeonId of unit.dungeonIds) {
      yield* sql`
        INSERT INTO
          dungeon_unit (dungeon_id, unit_id, created_at, updated_at)
        VALUES
          (
            ${dungeonId},
            ${unit.id},
            ${now},
            ${now}
          )
      `;
    }
  }
});
