import { NodeHttpServer } from "@effect/platform-node";
import * as Layer from "effect/Layer";

import { ApiServer } from "@/api/api-server.ts";
import { type FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { type AbilityApiService } from "@/services/api/ability/ability-api-service.ts";
import { type AppSettingsApiService } from "@/services/api/app-settings/app-settings-api-service.ts";
import { type ConfigurationApiService } from "@/services/api/configuration/configuration-api-service.ts";
import { type DungeonApiService } from "@/services/api/dungeon/dungeon-api-service.ts";
import { type DungeonRunApiService } from "@/services/api/dungeon-run/dungeon-run-api-service.ts";
import { type EncounterApiService } from "@/services/api/encounter/encounter-api-service.ts";
import { type LiveSplitApiService } from "@/services/api/live-split/live-split-api-service.ts";
import { type UnitApiService } from "@/services/api/unit/unit-api-service.ts";
import {
  DungeonRunWebSocketBroadcasterLive,
  LiveSplitWebSocketBroadcasterLive,
  TrackingWebSocketBroadcasterLive,
} from "@/services/api/websocket-broadcaster-service.ts";
import { AbilityApiServiceMock } from "@/tests/common/mocks/ability-api-service-mock.ts";
import { AppSettingsApiServiceMock } from "@/tests/common/mocks/app-settings-api-service-mock.ts";
import { ConfigurationApiServiceMock } from "@/tests/common/mocks/configuration-api-service-mock.ts";
import { DungeonApiServiceMock } from "@/tests/common/mocks/dungeon-api-service-mock.ts";
import { DungeonRunApiServiceMock } from "@/tests/common/mocks/dungeon-run-api-service-mock.ts";
import { EncounterApiServiceMock } from "@/tests/common/mocks/encounter-api-service-mock.ts";
import { FellowshipTrackerMock } from "@/tests/common/mocks/fellowship-tracker-service-mock.ts";
import { LiveSplitApiServiceMock } from "@/tests/common/mocks/live-split-api-service-mock.ts";
import { UnitApiServiceMock } from "@/tests/common/mocks/unit-api-service-mock.ts";

export type ApiServices =
  | AbilityApiService
  | AppSettingsApiService
  | ConfigurationApiService
  | DungeonApiService
  | DungeonRunApiService
  | EncounterApiService
  | FellowshipTracker
  | LiveSplitApiService
  | UnitApiService;

type ApiServiceTestLayer =
  | Layer.Layer<AbilityApiService>
  | Layer.Layer<AppSettingsApiService>
  | Layer.Layer<ConfigurationApiService>
  | Layer.Layer<DungeonApiService>
  | Layer.Layer<DungeonRunApiService>
  | Layer.Layer<EncounterApiService>
  | Layer.Layer<FellowshipTracker>
  | Layer.Layer<LiveSplitApiService>
  | Layer.Layer<UnitApiService>;

export const ApiServicesTest: Layer.Layer<ApiServices> = Layer.mergeAll(
  AbilityApiServiceMock,
  AppSettingsApiServiceMock,
  ConfigurationApiServiceMock,
  DungeonApiServiceMock,
  DungeonRunApiServiceMock,
  EncounterApiServiceMock,
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
    DungeonRunWebSocketBroadcasterLive,
    LiveSplitWebSocketBroadcasterLive,
    TrackingWebSocketBroadcasterLive,
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
