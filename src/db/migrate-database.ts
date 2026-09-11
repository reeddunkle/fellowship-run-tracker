import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Migrator from "effect/unstable/sql/Migrator";
import type * as SqlClient from "effect/unstable/sql/SqlClient";
import { type SqlError } from "effect/unstable/sql/SqlError";

import { createTables } from "@/db/migrations/0001-create-tables.ts";
import { seedTables } from "@/db/migrations/0002-seed-tables.ts";

export const migrateDatabase: E.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  FileSystem.FileSystem | SqlClient.SqlClient
> = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const seedTablesWithDependencies = seedTables.pipe(
    E.provideService(FileSystem.FileSystem, fileSystem),
  );

  const migrationLoader = Migrator.fromRecord({
    "1_create_tables": createTables,
    "2_seed_tables": seedTablesWithDependencies,
  });

  return yield* Migrator.make({})({
    loader: migrationLoader,
  });
});
