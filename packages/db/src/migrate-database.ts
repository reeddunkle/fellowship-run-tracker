import type * as E from "effect/Effect";
import * as Migrator from "effect/unstable/sql/Migrator";
import type * as SqlClient from "effect/unstable/sql/SqlClient";
import { type SqlError } from "effect/unstable/sql/SqlError";

import { createInitialMainSchema } from "@frt/db/migrations/main/0001-initial/index.ts";
import { createInitialStateSchema } from "@frt/db/migrations/state/0001-initial/index.ts";

type MigrateDatabase = E.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  SqlClient.SqlClient
>;

const runMigrations = Migrator.make({});

export const migrateMainDatabase: MigrateDatabase = runMigrations({
  loader: Migrator.fromRecord({
    "1_initial": createInitialMainSchema,
  }),
});

export const migrateStateDatabase: MigrateDatabase = runMigrations({
  loader: Migrator.fromRecord({
    "1_initial": createInitialStateSchema,
  }),
});
