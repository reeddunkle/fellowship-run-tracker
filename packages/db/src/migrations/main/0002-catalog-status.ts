import * as E from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export const addCatalogStatus = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE dungeon
    ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
      status IN ('ACTIVE', 'INACTIVE')
    )
  `;

  yield* sql`
    ALTER TABLE encounter
    ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
      status IN ('ACTIVE', 'INACTIVE')
    )
  `;
});
