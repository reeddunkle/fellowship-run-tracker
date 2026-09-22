import * as Layer from "effect/Layer";

import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { makeDatabasePersistenceLayer } from "@frt/db/database-persistence-layer.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

export type MakePersistenceLayerOptions = DatabaseOptions;

/*
 * The db package's persistence (database, DAOs, catalog sync) plus the
 * `DungeonRunRepository` built on top of it. `DungeonRunRepository.layer`
 * erases its DAOs internally, so the DAOs are also merged in directly for
 * consumers (e.g. FellowshipTracker) that use them without the repository.
 * The shared DAO `.layer` references are memoized, so each is built once.
 */
export function makePersistenceLayer({
  databaseFilename,
}: MakePersistenceLayerOptions) {
  return DungeonRunRepository.layer.pipe(
    Layer.provideMerge(
      makeDatabasePersistenceLayer({
        databaseFilename,
      }),
    ),
  );
}
