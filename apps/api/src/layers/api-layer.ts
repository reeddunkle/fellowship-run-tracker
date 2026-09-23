import * as Layer from "effect/Layer";

import { ApiServer } from "@frt/api/api/api-server.ts";
import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiLifecycleLayer } from "@frt/api/layers/api-lifecycle-layer.ts";
import { makeApiServicesLayer } from "@frt/api/layers/api-services-layer.ts";
import { NodeApiHttpServerLayer } from "@frt/api/services/api/node-api-http-server.ts";
import {
  DungeonRunWebSocketBroadcaster,
  LiveSplitWebSocketBroadcaster,
  TrackingWebSocketBroadcaster,
} from "@frt/api/services/api/websocket-broadcaster-service.ts";
import { BackgroundJobs } from "@frt/api/services/background-jobs/background-jobs-service.ts";

export type MakeApiLayerOptions = {
  readonly backgroundJobsDirectory: string;
  readonly encryptionKeyDirectory: string;
};

export function makeApiLayer(options: MakeApiLayerOptions) {
  const ApiRuntimeLayer = Layer.mergeAll(
    makeApiServicesLayer(options),
    BackgroundJobs.layerWith(options),
    FellowshipTracker.layerWith(options),
    DungeonRunWebSocketBroadcaster.layer,
    LiveSplitWebSocketBroadcaster.layer,
    TrackingWebSocketBroadcaster.layer,
    NodeApiHttpServerLayer,
  );

  return Layer.mergeAll(ApiServer, ApiLifecycleLayer).pipe(
    Layer.provide(ApiRuntimeLayer),
  );
}
