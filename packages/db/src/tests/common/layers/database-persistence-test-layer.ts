import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

export function makeDatabasePersistenceTestLayer(
  databaseFilename = ":memory:",
) {
  return makeDatabasePersistenceLayer(
    makeTestDatabaseOptions(databaseFilename),
  );
}
