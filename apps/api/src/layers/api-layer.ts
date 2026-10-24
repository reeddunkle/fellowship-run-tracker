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
import {
  type ApiRuntimeServiceLayers,
  makeApiServicesLayer,
} from "@frt/api/layers/api-services-layer.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";

export const makeApiLayer = (runtimeServiceLayers: ApiRuntimeServiceLayers) => {
  const ApiRuntimeLayer = Layer.mergeAll(
    makeApiServicesLayer(runtimeServiceLayers),
    FellowshipTracker.layer,
    DungeonRunWebSocketBroadcaster.layer,
    NodeApiHttpServerLayer,
    WebSocketClientShutdown.layer,
  );

  const ApiRuntimeWithWebSocketChannelLayer = WebSocketChannel.layer.pipe(
    Layer.provideMerge(ApiRuntimeLayer),
  );

  return shutdownWebSocketClientsFirst(
    Layer.mergeAll(ApiServer, ApiLifecycleLayer),
  ).pipe(Layer.provide(ApiRuntimeWithWebSocketChannelLayer));
};

export const ApiLayer = makeApiLayer({
  protectedValueStorageLayer: ProtectedValueStorage.localLayer,
  systemBrowserLayer: SystemBrowser.unavailableLayer,
});
