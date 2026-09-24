import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const createCatalogTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE catalog_sync (
      catalog TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE dungeon (
      id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE unit (
      id TEXT PRIMARY KEY NOT NULL,
      group_key TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
      variant TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE dungeon_unit (
      dungeon_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (dungeon_id, unit_id),
      FOREIGN KEY (dungeon_id) REFERENCES dungeon (id),
      FOREIGN KEY (unit_id) REFERENCES unit (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX dungeon_unit_unit_id_index ON dungeon_unit (unit_id)
  `;

  yield* sql`
    CREATE TABLE ability (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE ability_unit (
      ability_id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (ability_id) REFERENCES ability (id),
      FOREIGN KEY (unit_id) REFERENCES unit (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX ability_unit_unit_id_index ON ability_unit (unit_id)
  `;

  yield* sql`
    CREATE TABLE encounter (
      dungeon_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (dungeon_id, id),
      FOREIGN KEY (dungeon_id) REFERENCES dungeon (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX encounter_dungeon_id_index ON encounter (dungeon_id)
  `;
});
