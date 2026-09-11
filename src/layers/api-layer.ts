import * as Layer from "effect/Layer";

import { ApiServer } from "@/api/api-server.ts";
import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiLifecycleLive } from "@/layers/api-lifecycle-layer.ts";
import { ApiServicesLive } from "@/layers/api-services-layer.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { LiveSplitServicesLive } from "@/layers/live-split-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import {
  type MakePersistenceLayerOptions,
  makePersistenceLayer,
} from "@/layers/persistence-layer.ts";
import { NodeApiHttpServerLive } from "@/services/api/node-api-http-server.ts";
import {
  DungeonRunWebSocketBroadcasterLive,
  LiveSplitWebSocketBroadcasterLive,
  TrackingWebSocketBroadcasterLive,
} from "@/services/api/websocket-broadcaster-service.ts";
import { AppSettingsLive } from "@/services/app-settings/app-settings-service.ts";
import { AppLoggerLive } from "@/services/logging/app-logger-service.ts";

export type MakeApiLayerOptions = MakePersistenceLayerOptions;

export function makeApiLayer(options: MakeApiLayerOptions) {
  const PersistenceLive = makePersistenceLayer(options);

  const AppSettingsWithDependenciesLive = AppSettingsLive.pipe(
    Layer.provide(PersistenceLive),
  );

  const FellowshipWithDependenciesLive = FellowshipServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const LiveSplitWithDependenciesLive = LiveSplitServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const FellowshipTrackerWithDependenciesLive = FellowshipTrackerLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        PersistenceLive,
        FellowshipWithDependenciesLive,
        LiveSplitWithDependenciesLive,
        DungeonRunWebSocketBroadcasterLive,
      ),
    ),
  );

  const ApiServicesWithDependenciesLive = ApiServicesLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        PersistenceLive,
        AppSettingsWithDependenciesLive,
        LiveSplitWithDependenciesLive,
      ),
    ),
  );

  const ApiRuntimeLive = Layer.mergeAll(
    ApiServicesWithDependenciesLive,
    FellowshipTrackerWithDependenciesLive,
    DungeonRunWebSocketBroadcasterLive,
    LiveSplitWebSocketBroadcasterLive,
    TrackingWebSocketBroadcasterLive,
    NodeApiHttpServerLive,
  );

  const ApiApplicationLive = Layer.mergeAll(ApiServer, ApiLifecycleLive).pipe(
    Layer.provide(ApiRuntimeLive),
  );

  const AppLoggerWithPlatformLive = AppLoggerLive.pipe(
    Layer.provide(NodePlatformLive),
  );

  return Layer.mergeAll(AppLoggerWithPlatformLive, ApiApplicationLive);
}
