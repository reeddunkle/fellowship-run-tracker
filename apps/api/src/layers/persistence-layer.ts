import * as Layer from "effect/Layer";

import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

export type MakePersistenceLayerOptions = DatabaseOptions;

export function makePersistenceLayer(options: MakePersistenceLayerOptions) {
  return DungeonRunRepository.layer.pipe(
    Layer.provideMerge(makeDatabasePersistenceLayer(options)),
  );
}
