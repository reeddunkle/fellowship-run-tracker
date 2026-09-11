import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const createTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      live_splits_host TEXT NOT NULL,
      live_splits_port INTEGER NOT NULL CHECK (
        live_splits_port >= 1
        AND live_splits_port <= 65535
      ),
      fellowship_log_directory TEXT NOT NULL,
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

  yield* sql`
    CREATE TABLE configuration_definition (
      id TEXT PRIMARY KEY NOT NULL,
      dungeon_id TEXT NOT NULL,
      dungeon_level INTEGER NOT NULL CHECK (dungeon_level >= 1),
      fingerprint TEXT NOT NULL UNIQUE,
      canonical_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (dungeon_id) REFERENCES dungeon (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX configuration_definition_dungeon_id_dungeon_level_index ON configuration_definition (dungeon_id, dungeon_level)
  `;

  yield* sql`
    CREATE TABLE configuration (
      id TEXT PRIMARY KEY NOT NULL,
      configuration_definition_id TEXT NOT NULL,
      label TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      canonical_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (configuration_definition_id) REFERENCES configuration_definition (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX configuration_configuration_definition_id_index ON configuration (configuration_definition_id)
  `;

  yield* sql`
    CREATE TABLE requirement (
      id TEXT PRIMARY KEY NOT NULL,
      configuration_definition_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      start_occurrence INTEGER NOT NULL CHECK (start_occurrence >= 1),
      required_count INTEGER NOT NULL CHECK (required_count >= 1),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (configuration_definition_id) REFERENCES configuration_definition (id) ON DELETE CASCADE,
      UNIQUE (
        configuration_definition_id,
        type,
        target_id,
        start_occurrence,
        required_count
      )
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX requirement_configuration_definition_id_index ON requirement (configuration_definition_id)
  `;

  yield* sql`
    CREATE TABLE milestone (
      id TEXT PRIMARY KEY NOT NULL,
      configuration_id TEXT NOT NULL,
      label TEXT NOT NULL,
      comparison_time INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (configuration_id) REFERENCES configuration (id) ON DELETE CASCADE
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX milestone_configuration_id_index ON milestone (configuration_id)
  `;

  yield* sql`
    CREATE TABLE milestone_requirement (
      milestone_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (milestone_id, requirement_id),
      FOREIGN KEY (milestone_id) REFERENCES milestone (id) ON DELETE CASCADE,
      FOREIGN KEY (requirement_id) REFERENCES requirement (id) ON DELETE CASCADE
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX milestone_requirement_requirement_id_index ON milestone_requirement (requirement_id)
  `;

  yield* sql`
    CREATE TABLE dungeon_run (
      id TEXT PRIMARY KEY NOT NULL,
      configuration_definition_id TEXT NOT NULL,
      dungeon_id TEXT NOT NULL,
      dungeon_level INTEGER NOT NULL CHECK (dungeon_level >= 1),
      status TEXT NOT NULL CHECK (
        status IN ('ACTIVE', 'COMPLETED', 'INTERRUPTED', 'EXITED')
      ),
      started_at INTEGER,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        started_at IS NULL
        OR ended_at IS NULL
        OR ended_at >= started_at
      ) FOREIGN KEY (configuration_definition_id) REFERENCES configuration_definition (id),
      FOREIGN KEY (dungeon_id) REFERENCES dungeon (id)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX dungeon_run_configuration_definition_id_started_at_index ON dungeon_run (configuration_definition_id, started_at)
  `;

  yield* sql`
    CREATE INDEX dungeon_run_dungeon_id_dungeon_level_started_at_index ON dungeon_run (dungeon_id, dungeon_level, started_at)
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
