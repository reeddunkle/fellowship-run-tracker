import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const createConfigurationTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

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
});
