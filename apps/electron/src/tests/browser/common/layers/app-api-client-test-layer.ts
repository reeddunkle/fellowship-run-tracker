import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";

import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

function getHttpUrl(address: NetAddress.SocketAddress): string {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return NetAddress.formatUrlUnsafe(hostAddress);
}

const makeTestAppApiClient = E.gen(function* () {
  const httpServer = yield* HttpServer.HttpServer;

  return yield* HttpApiClient.make(AppHttpApi, {
    baseUrl: getHttpUrl(httpServer.address),
  });
});

export const TestAppApiClientTestLive = Layer.effect(
  AppApiClient,
  makeTestAppApiClient,
).pipe(Layer.provide(FetchHttpClient.layer));
