import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { AppApiClientLive } from "@/electron/renderer/services/app-api-client/app-api-client.ts";
import { BrowserAppStateLive } from "@/electron/renderer/services/app-state/browser-app-state-live.ts";
import { FellowshipCatalogDataServiceLive } from "@/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service";

const AppApiClientWithDependencies = AppApiClientLive.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const FellowshipCatalogDataServiceWithDependencies =
  FellowshipCatalogDataServiceLive.pipe(
    Layer.provide(AppApiClientWithDependencies),
  );

const BrowserLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateLive,
  AppApiClientWithDependencies,
  FellowshipCatalogDataServiceWithDependencies,
);

export const browserRuntime = ManagedRuntime.make(BrowserLive);
