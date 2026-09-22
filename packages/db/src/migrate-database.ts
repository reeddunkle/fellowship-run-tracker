import * as E from "effect/Effect";
import * as Migrator from "effect/unstable/sql/Migrator";
import type * as SqlClient from "effect/unstable/sql/SqlClient";
import { type SqlError } from "effect/unstable/sql/SqlError";

import { createTables } from "@frt/db/migrations/0001-create-tables.ts";

export const migrateDatabase: E.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  SqlClient.SqlClient
> = E.gen(function* () {
  const migrationLoader = Migrator.fromRecord({
    "1_create_tables": createTables,
  });

  return yield* Migrator.make({})({
    loader: migrationLoader,
  });
});
