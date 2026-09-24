import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";

import { getDatabaseOptions } from "@frt/api/helpers/get-database-options.ts";
import { makeFellowshipLogsCacheDatabaseLayer } from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { makeStateDatabaseLayer } from "@frt/db/databases/state-database.ts";

const DatabasesLayer = Layer.unwrap(
  E.map(getDatabaseOptions(), (databaseOptions) => {
    return Layer.mergeAll(
      makeMainDatabaseLayer(databaseOptions.databaseFilename),
      makeStateDatabaseLayer(databaseOptions.stateDatabaseFilename),
      makeFellowshipLogsCacheDatabaseLayer(
        databaseOptions.fellowshipLogsCacheDatabaseFilename,
      ),
    );
  }),
);

const runSetupDatabaseCommand = E.fn("cli.setup-database")(function* () {
  yield* E.logInfo("Databases are ready.");
});

export const setupDatabaseCommand = Command.make(
  "setup-database",
  {},
  runSetupDatabaseCommand,
).pipe(
  Command.withDescription(
    "Create the databases if needed and bring their schemas up to date.",
  ),
  Command.provide(DatabasesLayer),
);
