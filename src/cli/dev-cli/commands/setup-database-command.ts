import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const runSetupDatabaseCommand = E.fn("dev-cli.setup-database")(
  function* () {
    yield* SqlClient.SqlClient;

    yield* E.logInfo("Database is ready.");
  },
);
