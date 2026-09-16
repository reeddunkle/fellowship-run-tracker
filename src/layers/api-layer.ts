import * as Layer from "effect/Layer";

import { ApiServer } from "@/api/api-server.ts";
import { FellowshipLogsDungeonRunImporterLive } from "@/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service-live.ts";
import { FellowshipTrackerLive } from "@/application/fellowship-tracker/fellowship-tracker-service-live.ts";
import { ApiLifecycleLive } from "@/layers/api-lifecycle-layer.ts";
import { ApiServicesLive } from "@/layers/api-services-layer.ts";
import { AppSettingsWithDependenciesLive } from "@/layers/app-settings-layer.ts";
import { DungeonRunRepositoryWithDependenciesLive } from "@/layers/dungeon-run-repository-layer.ts";
import { FellowshipServicesLive } from "@/layers/fellowship-layer.ts";
import { makeFellowshipLogsLayer } from "@/layers/fellowship-logs-layer.ts";
import { LiveSplitServicesLive } from "@/layers/live-split-layer.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { NodeApiHttpServerLive } from "@/services/api/node-api-http-server.ts";
import {
  DungeonRunWebSocketBroadcasterLive,
  LiveSplitWebSocketBroadcasterLive,
  TrackingWebSocketBroadcasterLive,
} from "@/services/api/websocket-broadcaster-service.ts";
import { AppLoggerLive } from "@/services/logging/app-logger-service.ts";

export function makeApiLayer() {
  const FellowshipWithDependenciesLive = FellowshipServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const FellowshipLogsWithDependenciesLive = makeFellowshipLogsLayer(
    AppSettingsWithDependenciesLive,
  );

  const FellowshipLogsDungeonRunImporterWithDependenciesLive =
    FellowshipLogsDungeonRunImporterLive.pipe(
      Layer.provide(
        Layer.merge(
          FellowshipLogsWithDependenciesLive,
          DungeonRunRepositoryWithDependenciesLive,
        ),
      ),
    );

  const LiveSplitWithDependenciesLive = LiveSplitServicesLive.pipe(
    Layer.provide(AppSettingsWithDependenciesLive),
  );

  const FellowshipTrackerWithDependenciesLive = FellowshipTrackerLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        FellowshipWithDependenciesLive,
        LiveSplitWithDependenciesLive,
        DungeonRunWebSocketBroadcasterLive,
      ),
    ),
  );

  const ApiServicesWithDependenciesLive = ApiServicesLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        AppSettingsWithDependenciesLive,
        FellowshipLogsWithDependenciesLive,
        FellowshipLogsDungeonRunImporterWithDependenciesLive,
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
