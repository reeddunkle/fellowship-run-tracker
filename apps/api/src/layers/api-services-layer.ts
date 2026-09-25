import * as Layer from "effect/Layer";

import { AbilityCatalog } from "@frt/api/services/ability-catalog/ability-catalog-service.ts";
import { AppSettingsApiService } from "@frt/api/services/api/app-settings/app-settings-api-service.ts";
import { BackgroundJobApiService } from "@frt/api/services/api/background-job/background-job-api-service.ts";
import { ConfigurationLibrary } from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { DungeonCatalog } from "@frt/api/services/dungeon-catalog/dungeon-catalog-service.ts";
import { DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { EncounterCatalog } from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import { UnitCatalog } from "@frt/api/services/unit-catalog/unit-catalog-service.ts";

export const ApiServicesLayer = Layer.mergeAll(
  AbilityCatalog.layer,
  AppSettingsApiService.layer,
  BackgroundJobApiService.layer,
  ConfigurationLibrary.layer,
  DungeonCatalog.layer,
  DungeonRunHistory.layer,
  EncounterCatalog.layer,
  FellowshipLogs.layer,
  LiveSplit.layer,
  UnitCatalog.layer,
);
