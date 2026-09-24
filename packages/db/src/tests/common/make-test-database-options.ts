import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

/**
 * Database options for a test, from a single file. The state and cache
 * databases sit beside it, so a test that reopens the file for a new session
 * keeps all three. `:memory:` gives three separate in-memory databases.
 */
export function makeTestDatabaseOptions(
  databaseFilename = ":memory:",
): DatabaseOptions {
  if (databaseFilename === ":memory:") {
    return {
      databaseFilename,
      fellowshipLogsCacheDatabaseFilename: ":memory:",
      stateDatabaseFilename: ":memory:",
    };
  }

  const baseFilename = databaseFilename.replace(/\.db$/, "");

  return {
    databaseFilename,
    fellowshipLogsCacheDatabaseFilename: `${baseFilename}.fellowship-logs-cache.db`,
    stateDatabaseFilename: `${baseFilename}.state.db`,
  };
}
