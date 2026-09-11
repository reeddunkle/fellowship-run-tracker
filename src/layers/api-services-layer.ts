import * as Layer from "effect/Layer";

import { AbilityApiServiceLive } from "@/services/api/ability/ability-api-service.ts";
import { AppSettingsApiServiceLive } from "@/services/api/app-settings/app-settings-api-service.ts";
import { ConfigurationApiServiceLive } from "@/services/api/configuration/configuration-api-service.ts";
import { DungeonApiServiceLive } from "@/services/api/dungeon/dungeon-api-service.ts";
import { DungeonRunApiServiceLive } from "@/services/api/dungeon-run/dungeon-run-api-service.ts";
import { EncounterApiServiceLive } from "@/services/api/encounter/encounter-api-service.ts";
import { LiveSplitApiServiceLive } from "@/services/api/live-split/live-split-api-service.ts";
import { UnitApiServiceLive } from "@/services/api/unit/unit-api-service.ts";

export const ApiServicesLive = Layer.mergeAll(
  AbilityApiServiceLive,
  AppSettingsApiServiceLive,
  ConfigurationApiServiceLive,
  DungeonApiServiceLive,
  DungeonRunApiServiceLive,
  EncounterApiServiceLive,
  LiveSplitApiServiceLive,
  UnitApiServiceLive,
);
