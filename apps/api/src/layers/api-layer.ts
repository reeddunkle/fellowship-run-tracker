import * as Layer from "effect/Layer";

import { ApiServer } from "@frt/api/api/api-server.ts";
import { NodeApiHttpServerLayer } from "@frt/api/api/node-api-http-server.ts";
import {
  BackgroundJobWebSocketBroadcaster,
  DungeonRunWebSocketBroadcaster,
  LiveSplitWebSocketBroadcaster,
  TrackingWebSocketBroadcaster,
} from "@frt/api/api/websocket/websocket-broadcaster-service.ts";
import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiLifecycleLayer } from "@frt/api/layers/api-lifecycle-layer.ts";
import { ApiServicesLayer } from "@frt/api/layers/api-services-layer.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";

const ApiServicesWithBackgroundJobQueueLayer = ApiServicesLayer.pipe(
  Layer.provideMerge(BackgroundJobQueue.layer),
);

const ApiRuntimeLayer = Layer.mergeAll(
  ApiServicesWithBackgroundJobQueueLayer,
  BackgroundJobWebSocketBroadcaster.layer,
  FellowshipTracker.layer,
  DungeonRunWebSocketBroadcaster.layer,
  LiveSplitWebSocketBroadcaster.layer,
  TrackingWebSocketBroadcaster.layer,
  NodeApiHttpServerLayer,
);

export const ApiLayer = Layer.mergeAll(ApiServer, ApiLifecycleLayer).pipe(
  Layer.provide(ApiRuntimeLayer),
);
