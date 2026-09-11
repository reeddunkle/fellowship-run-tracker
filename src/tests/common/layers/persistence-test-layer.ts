import { makePersistenceLayer } from "@/layers/persistence-layer.ts";

export function makePersistenceTestLayer(databaseFilename = ":memory:") {
  return makePersistenceLayer({
    databaseFilename,
  });
}
