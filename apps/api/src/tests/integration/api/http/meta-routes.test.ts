import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import { describe, expect, test } from "vitest";

import {
  ApiServerTest,
  TEST_APP_VERSION,
} from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { API_CONTRACT_VERSION } from "@frt/api-contract/constants/api-contract-version.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

function getBaseUrl(address: NetAddress.SocketAddress) {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return NetAddress.formatUrlUnsafe(hostAddress);
}

describe("meta routes", () => {
  test("GET /meta returns the app and API contract versions", async () => {
    const meta = await E.gen(function* () {
      const httpServer = yield* HttpServer.HttpServer;

      const client = yield* HttpApiClient.make(AppHttpApi, {
        baseUrl: getBaseUrl(httpServer.address),
      });

      return yield* client.meta.getMeta();
    }).pipe(
      E.scoped,
      E.provide(Layer.mergeAll(ApiServerTest, FetchHttpClient.layer)),
      runTest,
    );

    expect(meta).toEqual({
      apiContractVersion: API_CONTRACT_VERSION,
      appVersion: TEST_APP_VERSION,
    });
  });
});
