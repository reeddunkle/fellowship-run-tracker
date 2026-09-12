import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { BrowserAppStateUpdateWorkerLive } from "@/services/app-state-update-worker/browser-app-state-update-worker-live.ts";

const BrowserLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateUpdateWorkerLive,
);

export const browserRuntime = ManagedRuntime.make(BrowserLive);
