import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const createSettingsTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE app_setting (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      fellowship_log_directory TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE live_split_setting (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      host TEXT NOT NULL,
      port INTEGER NOT NULL CHECK (
        port >= 1
        AND port <= 65535
      ),
      is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;

  // The secret is stored encrypted.
  yield* sql`
    CREATE TABLE fellowship_logs_credential (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      client_id TEXT,
      client_secret TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `;
});
