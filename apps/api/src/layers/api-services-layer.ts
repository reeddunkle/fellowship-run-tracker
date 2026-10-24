import * as Layer from "effect/Layer";

import { AbilityCatalog } from "@frt/api/services/ability-catalog/ability-catalog-service.ts";
import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import { BackgroundJob } from "@frt/api/services/background-job/background-job-service.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import { ConfigurationLibrary } from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { DungeonCatalog } from "@frt/api/services/dungeon-catalog/dungeon-catalog-service.ts";
import { DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { EncounterCatalog } from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { FellowshipLogsAccessToken } from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsConnectionManager } from "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import { FellowshipLogsWaitingJobResumerLayer } from "@frt/api/services/fellowship-logs-waiting-jobs/fellowship-logs-waiting-job-resumer.ts";
import { LiveSplit } from "@frt/api/services/live-split/live-split-service.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";
import { UnitCatalog } from "@frt/api/services/unit-catalog/unit-catalog-service.ts";

export type ApiRuntimeServiceLayers = {
  readonly protectedValueStorageLayer: Layer.Layer<ProtectedValueStorage>;
  readonly systemBrowserLayer: Layer.Layer<SystemBrowser>;
};

export const makeApiServicesLayer = (
  runtimeServiceLayers: ApiRuntimeServiceLayers,
) => {
  const FellowshipLogsSessionLayer = FellowshipLogsPointSystemOptIn.layer.pipe(
    Layer.provideMerge(
      FellowshipLogsAccessToken.layerWith(
        runtimeServiceLayers.protectedValueStorageLayer,
      ),
    ),
    Layer.provideMerge(
      FellowshipLogsConnection.layerWith(
        runtimeServiceLayers.protectedValueStorageLayer,
      ),
    ),
  );

  return Layer.mergeAll(
    AbilityCatalog.layer,
    AppSettings.layer,
    BackgroundJob.layer,
    ConfigurationLibrary.layer,
    DungeonCatalog.layer,
    DungeonRunHistory.layer,
    EncounterCatalog.layer,
    FellowshipLogs.layer,
    FellowshipLogsConnectionManager.layer,
    FellowshipLogsWaitingJobResumerLayer,
    LiveSplit.layer,
    UnitCatalog.layer,
  ).pipe(
    Layer.provideMerge(BackgroundJobQueue.layer),
    Layer.provideMerge(
      FellowshipLogsAuthorization.layerWith(runtimeServiceLayers),
    ),
    Layer.provideMerge(FellowshipLogsSessionLayer),
  );
};

export const ApiServicesLayer = makeApiServicesLayer({
  protectedValueStorageLayer: ProtectedValueStorage.localLayer,
  systemBrowserLayer: SystemBrowser.unavailableLayer,
});
