import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";

import { syncCatalogs } from "@frt/db/catalog-sync/sync-catalogs.ts";
import { AbilityDAO } from "@frt/db/daos/ability/ability-dao.ts";
import { AppSettingDAO } from "@frt/db/daos/app-setting/app-setting-dao.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { CatalogSyncDAO } from "@frt/db/daos/catalog-sync/catalog-sync-dao.ts";
import { ConfigurationDAO } from "@frt/db/daos/configuration/configuration-dao.ts";
import { DungeonDAO } from "@frt/db/daos/dungeon/dungeon-dao.ts";
import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { EncounterDAO } from "@frt/db/daos/encounter/encounter-dao.ts";
import { FellowshipLogsCredentialDAO } from "@frt/db/daos/fellowship-logs-credential/fellowship-logs-credential-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { LiveSplitSettingDAO } from "@frt/db/daos/live-split-setting/live-split-setting-dao.ts";
import { LocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { UnitDAO } from "@frt/db/daos/unit/unit-dao.ts";
import { makeFellowshipLogsCacheDatabaseLayer } from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { makeStateDatabaseLayer } from "@frt/db/databases/state-database.ts";
import { type DatabaseOptions } from "@frt/db/types/database-options.ts";

const MainDatabaseDAOsLayer = Layer.mergeAll(
  AbilityDAO.layer,
  AppSettingDAO.layer,
  CatalogSyncDAO.layer,
  ConfigurationDAO.layer,
  DungeonDAO.layer,
  DungeonRunDAO.layer,
  DungeonRunObservationDAO.layer,
  EncounterDAO.layer,
  FellowshipLogsCredentialDAO.layer,
  FellowshipLogsDungeonRunDAO.layer,
  LiveSplitSettingDAO.layer,
  LocalLogDungeonRunDAO.layer,
  UnitDAO.layer,
);

export function makeDatabasePersistenceLayer({
  databaseFilename,
  fellowshipLogsCacheDatabaseFilename,
  stateDatabaseFilename,
}: DatabaseOptions) {
  const MainPersistenceLayer = MainDatabaseDAOsLayer.pipe(
    Layer.provideMerge(makeMainDatabaseLayer(databaseFilename)),
  );

  const StatePersistenceLayer = BackgroundJobDAO.layer.pipe(
    Layer.provideMerge(makeStateDatabaseLayer(stateDatabaseFilename)),
  );

  const FellowshipLogsCachePersistenceLayer =
    FellowshipLogsResponseDAO.layer.pipe(
      Layer.provideMerge(
        makeFellowshipLogsCacheDatabaseLayer(
          fellowshipLogsCacheDatabaseFilename,
        ),
      ),
    );

  const PersistenceLayer = Layer.mergeAll(
    MainPersistenceLayer,
    StatePersistenceLayer,
    FellowshipLogsCachePersistenceLayer,
  );

  const CatalogSyncLayer = Layer.effectDiscard(syncCatalogs).pipe(
    Layer.provide(PersistenceLayer),
    Layer.provide(NodeServices.layer),
  );

  return Layer.merge(PersistenceLayer, CatalogSyncLayer);
}
