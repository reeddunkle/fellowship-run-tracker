import * as Layer from "effect/Layer";

import { AbilityApiService } from "@/services/api/ability/ability-api-service.ts";
import { AppSettingsApiService } from "@/services/api/app-settings/app-settings-api-service.ts";
import { ConfigurationApiService } from "@/services/api/configuration/configuration-api-service.ts";
import { DungeonApiService } from "@/services/api/dungeon/dungeon-api-service.ts";
import { DungeonRunApiService } from "@/services/api/dungeon-run/dungeon-run-api-service.ts";
import { EncounterApiService } from "@/services/api/encounter/encounter-api-service.ts";
import { FellowshipLogsApiService } from "@/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { LiveSplitApiService } from "@/services/api/live-split/live-split-api-service.ts";
import { UnitApiService } from "@/services/api/unit/unit-api-service.ts";

export function makeApiServicesLayer(options: {
  readonly encryptionKeyDirectory: string;
}) {
  return Layer.mergeAll(
    AbilityApiService.layer,
    AppSettingsApiService.layerWith(options),
    ConfigurationApiService.layer,
    DungeonApiService.layer,
    DungeonRunApiService.layer,
    EncounterApiService.layer,
    FellowshipLogsApiService.layerWith(options),
    LiveSplitApiService.layerWith(options),
    UnitApiService.layer,
  );
}
