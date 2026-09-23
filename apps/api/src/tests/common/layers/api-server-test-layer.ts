import { NodeHttpServer } from "@effect/platform-node";
import * as Layer from "effect/Layer";

import { ApiServer } from "@frt/api/api/api-server.ts";
import { type FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type AbilityApiService } from "@frt/api/services/api/ability/ability-api-service.ts";
import { type AppSettingsApiService } from "@frt/api/services/api/app-settings/app-settings-api-service.ts";
import { type BackgroundJobApiService } from "@frt/api/services/api/background-job/background-job-api-service.ts";
import { type ConfigurationApiService } from "@frt/api/services/api/configuration/configuration-api-service.ts";
import { type DungeonApiService } from "@frt/api/services/api/dungeon/dungeon-api-service.ts";
import { type DungeonRunApiService } from "@frt/api/services/api/dungeon-run/dungeon-run-api-service.ts";
import { type EncounterApiService } from "@frt/api/services/api/encounter/encounter-api-service.ts";
import { type FellowshipLogsApiService } from "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { type LiveSplitApiService } from "@frt/api/services/api/live-split/live-split-api-service.ts";
import { type UnitApiService } from "@frt/api/services/api/unit/unit-api-service.ts";
import {
  BackgroundJobWebSocketBroadcaster,
  DungeonRunWebSocketBroadcaster,
  LiveSplitWebSocketBroadcaster,
  TrackingWebSocketBroadcaster,
} from "@frt/api/services/api/websocket-broadcaster-service.ts";
import { AbilityApiServiceMock } from "@frt/api/tests/common/mocks/ability-api-service-mock.ts";
import { AppSettingsApiServiceMock } from "@frt/api/tests/common/mocks/app-settings-api-service-mock.ts";
import { BackgroundJobApiServiceMock } from "@frt/api/tests/common/mocks/background-job-api-service-mock.ts";
import { ConfigurationApiServiceMock } from "@frt/api/tests/common/mocks/configuration-api-service-mock.ts";
import { DungeonApiServiceMock } from "@frt/api/tests/common/mocks/dungeon-api-service-mock.ts";
import { DungeonRunApiServiceMock } from "@frt/api/tests/common/mocks/dungeon-run-api-service-mock.ts";
import { EncounterApiServiceMock } from "@frt/api/tests/common/mocks/encounter-api-service-mock.ts";
import { FellowshipLogsApiServiceMock } from "@frt/api/tests/common/mocks/fellowship-logs-api-service-mock.ts";
import { FellowshipTrackerMock } from "@frt/api/tests/common/mocks/fellowship-tracker-service-mock.ts";
import { LiveSplitApiServiceMock } from "@frt/api/tests/common/mocks/live-split-api-service-mock.ts";
import { UnitApiServiceMock } from "@frt/api/tests/common/mocks/unit-api-service-mock.ts";

export type ApiServices =
  | AbilityApiService
  | AppSettingsApiService
  | BackgroundJobApiService
  | ConfigurationApiService
  | DungeonApiService
  | DungeonRunApiService
  | EncounterApiService
  | FellowshipLogsApiService
  | FellowshipTracker
  | LiveSplitApiService
  | UnitApiService;

type ApiServiceTestLayer =
  | Layer.Layer<AbilityApiService>
  | Layer.Layer<AppSettingsApiService>
  | Layer.Layer<BackgroundJobApiService>
  | Layer.Layer<ConfigurationApiService>
  | Layer.Layer<DungeonApiService>
  | Layer.Layer<DungeonRunApiService>
  | Layer.Layer<EncounterApiService>
  | Layer.Layer<FellowshipLogsApiService>
  | Layer.Layer<FellowshipTracker>
  | Layer.Layer<LiveSplitApiService>
  | Layer.Layer<UnitApiService>;

export const ApiServicesTest: Layer.Layer<ApiServices> = Layer.mergeAll(
  AbilityApiServiceMock,
  AppSettingsApiServiceMock,
  BackgroundJobApiServiceMock,
  ConfigurationApiServiceMock,
  DungeonApiServiceMock,
  DungeonRunApiServiceMock,
  EncounterApiServiceMock,
  FellowshipLogsApiServiceMock,
  FellowshipTrackerMock,
  LiveSplitApiServiceMock,
  UnitApiServiceMock,
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
