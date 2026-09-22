import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";

export function makeDatabasePersistenceTestLayer(
  databaseFilename = ":memory:",
) {
  return makeDatabasePersistenceLayer({
    databaseFilename,
  });
}
