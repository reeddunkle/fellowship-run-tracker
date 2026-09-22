import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { getDatabaseFilename } from "@frt/api/helpers/get-database-filename.ts";
import { makeDatabaseLayer } from "@frt/db/database-layer.ts";

// Building the database layer creates the file and runs migrations.
const DatabaseLayer = Layer.unwrap(
  E.map(getDatabaseFilename(), makeDatabaseLayer),
);

const runSetupDatabaseCommand = E.fn("cli.setup-database")(function* () {
  yield* SqlClient.SqlClient;

  yield* E.logInfo("Database is ready.");
});

export const setupDatabaseCommand = Command.make(
  "setup-database",
  {},
  runSetupDatabaseCommand,
).pipe(
  Command.withDescription("Create the database if needed and run migrations."),
  Command.provide(DatabaseLayer),
);
