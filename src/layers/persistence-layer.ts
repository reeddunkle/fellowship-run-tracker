import * as Layer from "effect/Layer";

import { syncCatalogs } from "@/db/catalog-sync/sync-catalogs.ts";
import { AbilityDAO } from "@/db/daos/ability/ability-dao.ts";
import { AppSettingsDAO } from "@/db/daos/app-settings/app-settings-dao.ts";
import { CatalogSyncDAO } from "@/db/daos/catalog-sync/catalog-sync-dao.ts";
import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonDAO } from "@/db/daos/dungeon/dungeon-dao.ts";
import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { EncounterDAO } from "@/db/daos/encounter/encounter-dao.ts";
import { LocalLogDungeonRunDAO } from "@/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { UnitDAO } from "@/db/daos/unit/unit-dao.ts";
import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { FellowshipLogsDungeonRunDAO } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { NodePlatformLayer } from "@/layers/node-platform-layer.ts";
import { DungeonRunRepository } from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakePersistenceLayerOptions = DatabaseOptions;

/*
 * DungeonRunRepository.layer erases its 4 DAOs internally via Layer.provide
 * (not provideMerge), so those DAOs must also be merged in directly here to
 * remain available to consumers (e.g. FellowshipTracker) that depend on them
 * without going through DungeonRunRepository. The shared `.layer` references
 * are memoized by Effect, so each DAO is still only constructed once.
 */
const PersistenceServicesLayer = Layer.mergeAll(
  AbilityDAO.layer,
  AppSettingsDAO.layer,
  CatalogSyncDAO.layer,
  ConfigurationDAO.layer,
  DungeonDAO.layer,
  DungeonRunDAO.layer,
  DungeonRunObservationDAO.layer,
  DungeonRunRepository.layer,
  EncounterDAO.layer,
  FellowshipLogsDungeonRunDAO.layer,
  LocalLogDungeonRunDAO.layer,
  UnitDAO.layer,
);

export function makePersistenceLayer({
  databaseFilename,
}: MakePersistenceLayerOptions) {
  const DatabaseLayer = makeDatabaseLayer(databaseFilename);

  const PersistenceLayer = PersistenceServicesLayer.pipe(
    Layer.provideMerge(DatabaseLayer),
  );

  const CatalogSyncLayer = Layer.effectDiscard(syncCatalogs).pipe(
    Layer.provide(PersistenceLayer),
    Layer.provide(NodePlatformLayer),
  );

  return Layer.merge(PersistenceLayer, CatalogSyncLayer);
}
