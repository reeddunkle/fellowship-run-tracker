import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const createDungeonRunTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE dungeon_run (
      id TEXT PRIMARY KEY NOT NULL,
      dungeon_id TEXT NOT NULL,
      dungeon_level INTEGER NOT NULL CHECK (dungeon_level >= 1),
      source TEXT NOT NULL CHECK (source IN ('LOCAL_LOG', 'FELLOWSHIP_LOGS')),
      is_own_run INTEGER NOT NULL CHECK (is_own_run IN (0, 1)),
      started_at INTEGER,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        started_at IS NULL
        OR ended_at IS NULL
        OR ended_at >= started_at
      ),
      FOREIGN KEY (dungeon_id) REFERENCES dungeon (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX dungeon_run_dungeon_id_dungeon_level_started_at_index ON dungeon_run (dungeon_id, dungeon_level, started_at)
  `;

  yield* sql`
    CREATE INDEX dungeon_run_source_dungeon_id_dungeon_level_started_at_index ON dungeon_run (source, dungeon_id, dungeon_level, started_at)
  `;

  yield* sql`
    CREATE INDEX dungeon_run_is_own_run_dungeon_id_dungeon_level_started_at_index ON dungeon_run (is_own_run, dungeon_id, dungeon_level, started_at)
  `;

  yield* sql`
    CREATE TABLE local_log_dungeon_run (
      dungeon_run_id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('ACTIVE', 'COMPLETED', 'INTERRUPTED', 'EXITED')
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (dungeon_run_id) REFERENCES dungeon_run (id) ON DELETE CASCADE
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE fellowship_logs_dungeon_run (
      dungeon_run_id TEXT PRIMARY KEY NOT NULL,
      report_code TEXT NOT NULL,
      fight_id INTEGER NOT NULL CHECK (fight_id >= 1),
      created_at INTEGER NOT NULL,
      UNIQUE (report_code, fight_id),
      FOREIGN KEY (dungeon_run_id) REFERENCES dungeon_run (id) ON DELETE CASCADE
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE dungeon_run_observation (
      id TEXT PRIMARY KEY NOT NULL,
      dungeon_run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (dungeon_run_id) REFERENCES dungeon_run (id) ON DELETE CASCADE
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX dungeon_run_observation_dungeon_run_id_observed_at_index ON dungeon_run_observation (dungeon_run_id, observed_at)
  `;

  yield* sql`
    CREATE INDEX dungeon_run_observation_dungeon_run_id_type_target_id_observed_at_index ON dungeon_run_observation (dungeon_run_id, type, target_id, observed_at)
  `;
});
