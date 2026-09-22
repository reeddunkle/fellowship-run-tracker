import { makePersistenceLayer } from "@frt/api/layers/persistence-layer.ts";

export function makePersistenceTestLayer(databaseFilename = ":memory:") {
  return makePersistenceLayer({
    databaseFilename,
  });
}
