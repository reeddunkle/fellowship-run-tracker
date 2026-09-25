import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { AppApiClientLayer } from "@/renderer/services/app-api-client/app-api-client.ts";
import { BrowserAppStateLayer } from "@/renderer/services/app-state/browser-app-state-layer.ts";
import { FellowshipCatalogDataLayer } from "@/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";

const AppApiClientWithDependencies = AppApiClientLayer.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const FellowshipCatalogDataWithDependencies = FellowshipCatalogDataLayer.pipe(
  Layer.provide(AppApiClientWithDependencies),
);

const BrowserLayer = Layer.mergeAll(
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
