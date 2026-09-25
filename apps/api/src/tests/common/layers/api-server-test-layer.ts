import { NodeHttpServer } from "@effect/platform-node";
import * as Layer from "effect/Layer";

import { ApiServer } from "@frt/api/api/api-server.ts";
import {
  BackgroundJobWebSocketBroadcaster,
  DungeonRunWebSocketBroadcaster,
  LiveSplitWebSocketBroadcaster,
  TrackingWebSocketBroadcaster,
} from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { type FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type AbilityCatalog } from "@frt/api/services/ability-catalog/ability-catalog-service.ts";
import { type AppSettingsApiService } from "@frt/api/services/api/app-settings/app-settings-api-service.ts";
import { type BackgroundJobApiService } from "@frt/api/services/api/background-job/background-job-api-service.ts";
import { type LiveSplitApiService } from "@frt/api/services/api/live-split/live-split-api-service.ts";
import { type ConfigurationLibrary } from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { type DungeonCatalog } from "@frt/api/services/dungeon-catalog/dungeon-catalog-service.ts";
import { type DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { type EncounterCatalog } from "@frt/api/services/encounter-catalog/encounter-catalog-service.ts";
import { type FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type UnitCatalog } from "@frt/api/services/unit-catalog/unit-catalog-service.ts";
import { AbilityCatalogMock } from "@frt/api/tests/common/mocks/ability-catalog-mock.ts";
import { AppSettingsApiServiceMock } from "@frt/api/tests/common/mocks/app-settings-api-service-mock.ts";
import { BackgroundJobApiServiceMock } from "@frt/api/tests/common/mocks/background-job-api-service-mock.ts";
import { ConfigurationLibraryMock } from "@frt/api/tests/common/mocks/configuration-library-mock.ts";
import { DungeonCatalogMock } from "@frt/api/tests/common/mocks/dungeon-catalog-mock.ts";
import { DungeonRunHistoryMock } from "@frt/api/tests/common/mocks/dungeon-run-history-mock.ts";
import { EncounterCatalogMock } from "@frt/api/tests/common/mocks/encounter-catalog-mock.ts";
import { FellowshipLogsMock } from "@frt/api/tests/common/mocks/fellowship-logs-mock.ts";
import { FellowshipTrackerMock } from "@frt/api/tests/common/mocks/fellowship-tracker-service-mock.ts";
import { LiveSplitApiServiceMock } from "@frt/api/tests/common/mocks/live-split-api-service-mock.ts";
import { UnitCatalogMock } from "@frt/api/tests/common/mocks/unit-catalog-mock.ts";

export type ApiServices =
  | AbilityCatalog
  | AppSettingsApiService
  | BackgroundJobApiService
  | ConfigurationLibrary
  | DungeonCatalog
  | DungeonRunHistory
  | EncounterCatalog
  | FellowshipLogs
  | FellowshipTracker
  | LiveSplitApiService
  | UnitCatalog;

type ApiServiceTestLayer =
  | Layer.Layer<AbilityCatalog>
  | Layer.Layer<AppSettingsApiService>
  | Layer.Layer<BackgroundJobApiService>
  | Layer.Layer<ConfigurationLibrary>
  | Layer.Layer<DungeonCatalog>
  | Layer.Layer<DungeonRunHistory>
  | Layer.Layer<EncounterCatalog>
  | Layer.Layer<FellowshipLogs>
  | Layer.Layer<FellowshipTracker>
  | Layer.Layer<LiveSplitApiService>
  | Layer.Layer<UnitCatalog>;

export const ApiServicesTest: Layer.Layer<ApiServices> = Layer.mergeAll(
  AbilityCatalogMock,
  AppSettingsApiServiceMock,
  BackgroundJobApiServiceMock,
  ConfigurationLibraryMock,
  DungeonCatalogMock,
  DungeonRunHistoryMock,
  EncounterCatalogMock,
  FellowshipLogsMock,
  FellowshipTrackerMock,
  LiveSplitApiServiceMock,
  UnitCatalogMock,
);

function makeApiServicesTestLayer(
  ...overrides: ReadonlyArray<ApiServiceTestLayer>
): Layer.Layer<ApiServices> {
  return Layer.mergeAll(ApiServicesTest, ...overrides);
}

export function makeApiServerTestLayer(
  apiServicesLayer: Layer.Layer<ApiServices> = ApiServicesTest,
) {
  const ApiServerDependenciesTest = Layer.mergeAll(
    apiServicesLayer,
    BackgroundJobWebSocketBroadcaster.layer,
    DungeonRunWebSocketBroadcaster.layer,
    LiveSplitWebSocketBroadcaster.layer,
    TrackingWebSocketBroadcaster.layer,
    NodeHttpServer.layerTest,
  );

  return ApiServer.pipe(Layer.provideMerge(ApiServerDependenciesTest));
}

export function makeApiServerTestLayerWith(
  ...overrides: ReadonlyArray<ApiServiceTestLayer>
) {
  return makeApiServerTestLayer(makeApiServicesTestLayer(...overrides));
}

export const ApiServerTest = makeApiServerTestLayer();
