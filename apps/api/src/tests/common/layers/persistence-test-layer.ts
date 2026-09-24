import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";
import { makeTestDatabaseOptions } from "@frt/db/tests/common/make-test-database-options.ts";

export function makePersistenceTestLayer(databaseFilename = ":memory:") {
  return makePersistenceLayer(makeTestDatabaseOptions(databaseFilename));
}
