import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { ABILITIES_CATALOG } from "@/catalogs/abilities/fellowship-abilities-catalog.ts";

export const seedAbilityTable = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = DateTime.toEpochMillis(yield* DateTime.now);

  for (const ability of Object.values(ABILITIES_CATALOG)) {
    yield* sql`
      INSERT INTO
        ability (id, name, created_at, updated_at)
      VALUES
        (
          ${ability.id},
          ${ability.name},
          ${now},
          ${now}
        )
    `;

    if ("unitId" in ability) {
      yield* sql`
        INSERT INTO
          ability_unit (ability_id, unit_id, created_at, updated_at)
        VALUES
          (
            ${ability.id},
            ${ability.unitId},
            ${now},
            ${now}
          )
      `;
    }
  }
});
