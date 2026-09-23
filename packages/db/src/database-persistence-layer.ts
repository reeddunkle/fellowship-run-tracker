import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";

import { syncCatalogs } from "@frt/db/catalog-sync/sync-catalogs.ts";
import { AbilityDAO } from "@frt/db/daos/ability/ability-dao.ts";
import { AppSettingsDAO } from "@frt/db/daos/app-settings/app-settings-dao.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { ConfigurationDAO } from "@frt/db/daos/configuration/configuration-dao.ts";
import { DungeonDAO } from "@frt/db/daos/dungeon/dungeon-dao.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { EncounterDAO } from "@frt/db/daos/encounter/encounter-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { UnitDAO } from "@frt/db/daos/unit/unit-dao.ts";
import { makeDatabaseLayer } from "@frt/db/database-layer.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

const DAOsLayer = Layer.mergeAll(
  AbilityDAO.layer,
  AppSettingsDAO.layer,
  BackgroundJobDAO.layer,
  CatalogSyncDAO.layer,
  ConfigurationDAO.layer,
  DungeonDAO.layer,
  DungeonRunDAO.layer,
  DungeonRunObservationDAO.layer,
  EncounterDAO.layer,
  FellowshipLogsDungeonRunDAO.layer,
  FellowshipLogsImportPageDAO.layer,
  LocalLogDungeonRunDAO.layer,
  UnitDAO.layer,
);

export function makeDatabasePersistenceLayer({
  databaseFilename,
}: DatabaseOptions) {
  const PersistenceLayer = DAOsLayer.pipe(
    Layer.provideMerge(makeDatabaseLayer(databaseFilename)),
  );

  const CatalogSyncLayer = Layer.effectDiscard(syncCatalogs).pipe(
    Layer.provide(PersistenceLayer),
    Layer.provide(NodeServices.layer),
  );

  return Layer.merge(PersistenceLayer, CatalogSyncLayer);
}
