import * as Layer from "effect/Layer";

import { AbilityApiService } from "@frt/api/services/api/ability/ability-api-service.ts";
import { AppSettingsApiService } from "@frt/api/services/api/app-settings/app-settings-api-service.ts";
import { ConfigurationApiService } from "@frt/api/services/api/configuration/configuration-api-service.ts";
import { DungeonApiService } from "@frt/api/services/api/dungeon/dungeon-api-service.ts";
import { DungeonRunApiService } from "@frt/api/services/api/dungeon-run/dungeon-run-api-service.ts";
import { EncounterApiService } from "@frt/api/services/api/encounter/encounter-api-service.ts";
import { FellowshipLogsApiService } from "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { LiveSplitApiService } from "@frt/api/services/api/live-split/live-split-api-service.ts";
import { UnitApiService } from "@frt/api/services/api/unit/unit-api-service.ts";

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
