import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { AppApiClientLive } from "@/electron/renderer/services/app-api-client/app-api-client";
import { BrowserAppStateLive } from "@/electron/renderer/services/app-state/browser-app-state-live.ts";

const AppHttpApiClientWithDependencies = AppApiClientLive.pipe(
  Layer.provide(FetchHttpClient.layer),
);

const BrowserLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateLive,
  AppHttpApiClientWithDependencies,
);

export const browserRuntime = ManagedRuntime.make(BrowserLive);
