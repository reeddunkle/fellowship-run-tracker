import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { AppApiClientLayer } from "@/electron/renderer/services/app-api-client/app-api-client.ts";
import { BrowserAppStateLayer } from "@/electron/renderer/services/app-state/browser-app-state-layer.ts";
import { FellowshipCatalogDataServiceLayer } from "@/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";

const AppApiClientWithDependencies = AppApiClientLayer.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const FellowshipCatalogDataServiceWithDependencies =
  FellowshipCatalogDataServiceLayer.pipe(
    Layer.provide(AppApiClientWithDependencies),
  );

const BrowserLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateLayer,
  AppApiClientWithDependencies,
  FellowshipCatalogDataServiceWithDependencies,
);

export const browserRuntime = ManagedRuntime.make(BrowserLayer);

let isDisposed = false;

export function disposeBrowserRuntime(): void {
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
