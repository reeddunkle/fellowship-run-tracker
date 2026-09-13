import * as Layer from "effect/Layer";

import { syncCatalogs } from "@/db/catalog-sync/sync-catalogs.ts";
import { AbilityDAOLive } from "@/db/daos/ability/ability-dao-live.ts";
import { AppSettingsDAOLive } from "@/db/daos/app-settings/app-settings-dao-live.ts";
import { CatalogSyncDAOLive } from "@/db/daos/catalog-sync/catalog-sync-dao-live.ts";
import { ConfigurationDAOLive } from "@/db/daos/configuration/configuration-dao-live.ts";
import { DungeonDAOLive } from "@/db/daos/dungeon/dungeon-dao-live.ts";
import { DungeonRunDAOLive } from "@/db/daos/dungeon-run/dungeon-run-dao-live.ts";
import { DungeonRunObservationDAOLive } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao-live.ts";
import { EncounterDAOLive } from "@/db/daos/encounter/encounter-dao-live.ts";
import { UnitDAOLive } from "@/db/daos/unit/unit-dao-live.ts";
import { makeDatabaseLayer } from "@/db/database-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { type DatabaseOptions } from "@/types/app-options.ts";

export type MakePersistenceLayerOptions = DatabaseOptions;

const PersistenceServicesLive = Layer.mergeAll(
  AbilityDAOLive,
  AppSettingsDAOLive,
  CatalogSyncDAOLive,
  ConfigurationDAOLive,
  DungeonDAOLive,
  DungeonRunDAOLive,
  DungeonRunObservationDAOLive,
  EncounterDAOLive,
  UnitDAOLive,
);

export function makePersistenceLayer({
  databaseFilename,
}: MakePersistenceLayerOptions) {
  const DatabaseLive = makeDatabaseLayer(databaseFilename);

  const PersistenceLive = PersistenceServicesLive.pipe(
    Layer.provideMerge(DatabaseLive),
  );

  const CatalogSyncLive = Layer.effectDiscard(syncCatalogs).pipe(
    Layer.provide(PersistenceLive),
    Layer.provide(NodePlatformLive),
  );

  return Layer.merge(PersistenceLive, CatalogSyncLive);
}
