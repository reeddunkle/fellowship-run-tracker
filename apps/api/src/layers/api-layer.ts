import * as Layer from "effect/Layer";

import { ApiServer } from "@frt/api/api/api-server.ts";
import { NodeApiHttpServerLayer } from "@frt/api/api/node-api-http-server.ts";
import { DungeonRunWebSocketBroadcaster } from "@frt/api/api/websocket/dungeon-run/dungeon-run-websocket-broadcaster-service.ts";
import { WebSocketChannel } from "@frt/api/api/websocket/websocket-channel-service.ts";
import {
  shutdownWebSocketClientsFirst,
  WebSocketClientShutdown,
} from "@frt/api/api/websocket/websocket-client-shutdown-service.ts";
import { FellowshipTracker } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import { ApiLifecycleLayer } from "@frt/api/layers/api-lifecycle-layer.ts";
import { ApiServicesLayer } from "@frt/api/layers/api-services-layer.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";

const ApiServicesWithBackgroundJobQueueLayer = ApiServicesLayer.pipe(
  Layer.provideMerge(BackgroundJobQueue.layer),
);

const ApiRuntimeLayer = Layer.mergeAll(
  ApiServicesWithBackgroundJobQueueLayer,
  FellowshipTracker.layer,
  DungeonRunWebSocketBroadcaster.layer,
  NodeApiHttpServerLayer,
  WebSocketClientShutdown.layer,
);

const ApiRuntimeWithWebSocketChannelLayer = WebSocketChannel.layer.pipe(
  Layer.provideMerge(ApiRuntimeLayer),
);

export const ApiLayer = shutdownWebSocketClientsFirst(
  Layer.mergeAll(ApiServer, ApiLifecycleLayer),
).pipe(Layer.provide(ApiRuntimeWithWebSocketChannelLayer));
