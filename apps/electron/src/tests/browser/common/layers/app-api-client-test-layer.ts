import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

function getHttpUrl(address: HttpServer.Address): string {
  if (address._tag === "UnixAddress") {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `http://${hostname}:${address.port}`;
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
