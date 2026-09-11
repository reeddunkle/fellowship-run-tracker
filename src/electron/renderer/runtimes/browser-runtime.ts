import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Socket from "effect/unstable/socket/Socket";

const BrowserLive = Layer.mergeAll(
  FetchHttpClient.layer,
  Socket.layerWebSocketConstructorGlobal,
);

export const browserRuntime = ManagedRuntime.make(BrowserLive);
