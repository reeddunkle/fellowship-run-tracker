import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Socket from "effect/socket/Socket";

import { RendererLoggerLayer } from "@/renderer/logging/renderer-logger-layer.ts";
import { AppApiClientLayer } from "@/renderer/services/app-api-client/app-api-client.ts";
import { BrowserAppStateLayer } from "@/renderer/services/app-state/browser-app-state-layer.ts";
import { FellowshipCatalogDataLayer } from "@/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";

const AppApiClientWithDependencies = AppApiClientLayer.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const FellowshipCatalogDataWithDependencies = FellowshipCatalogDataLayer.pipe(
  Layer.provide(AppApiClientWithDependencies),
);

const TracerPropagationDisabledLayer = Layer.succeed(
  HttpClient.TracerPropagationEnabled,
)(false);

const BrowserLayer = Layer.mergeAll(
  RendererLoggerLayer,
  TracerPropagationDisabledLayer,
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateLayer,
  AppApiClientWithDependencies,
  FellowshipCatalogDataWithDependencies,
);

export const browserRuntime = ManagedRuntime.make(BrowserLayer);

let isDisposed = false;

function disposeBrowserRuntime(): void {
  if (isDisposed) {
    return;
  }

  isDisposed = true;
  void browserRuntime.dispose();
}

window.addEventListener("pagehide", disposeBrowserRuntime, { once: true });

if (import.meta.hot !== undefined) {
  import.meta.hot.dispose(disposeBrowserRuntime);
}
