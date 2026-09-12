import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

import { BrowserAppStateLive } from "@/services/app-state/browser-app-state-live.ts";

const BrowserLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
  BrowserAppStateLive,
);

export const browserRuntime = ManagedRuntime.make(BrowserLive);
