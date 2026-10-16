import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

export type MakePersistenceLayerOptions = DatabaseOptions;

export function makePersistenceLayer(options: MakePersistenceLayerOptions) {
  return makeDatabasePersistenceLayer(options);
}
