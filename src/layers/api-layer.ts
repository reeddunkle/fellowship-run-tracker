import * as Layer from "effect/Layer";

import { ApiServer } from "@/api/api-server.ts";
import { FellowshipTracker } from "@/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiLifecycleLayer } from "@/layers/api-lifecycle-layer.ts";
import { makeApiServicesLayer } from "@/layers/api-services-layer.ts";
import { NodePlatformLayer } from "@/layers/node-platform-layer.ts";
import { NodeApiHttpServerLayer } from "@/services/api/node-api-http-server.ts";
import {
  DungeonRunWebSocketBroadcaster,
  LiveSplitWebSocketBroadcaster,
  TrackingWebSocketBroadcaster,
} from "@/services/api/websocket-broadcaster-service.ts";
import { AppLoggerLayer } from "@/services/logging/app-logger-service.ts";

export type MakeApiLayerOptions = {
  readonly encryptionKeyDirectory: string;
};

export function makeApiLayer(options: MakeApiLayerOptions) {
  const ApiRuntimeLayer = Layer.mergeAll(
    makeApiServicesLayer(options),
    FellowshipTracker.layerWith(options),
    DungeonRunWebSocketBroadcaster.layer,
    LiveSplitWebSocketBroadcaster.layer,
    TrackingWebSocketBroadcaster.layer,
    NodeApiHttpServerLayer,
  );

  const ApiApplicationLayer = Layer.mergeAll(ApiServer, ApiLifecycleLayer).pipe(
    Layer.provide(ApiRuntimeLayer),
  );

  const AppLoggerWithPlatformLayer = AppLoggerLayer.pipe(
    Layer.provide(NodePlatformLayer),
  );

  return Layer.mergeAll(AppLoggerWithPlatformLayer, ApiApplicationLayer);
}
