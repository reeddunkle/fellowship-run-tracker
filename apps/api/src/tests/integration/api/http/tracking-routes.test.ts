import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import { describe, expect, test } from "vitest";

import { type FellowshipTrackerStartError } from "@frt/api/application/fellowship-tracker/fellowship-tracker-service.ts";
import {
  FellowshipTrackerAlreadyRunningError,
  FellowshipTrackerConfigurationNotFoundError,
} from "@frt/api/errors/fellowship-tracker-error.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeFellowshipTrackerMock } from "@frt/api/tests/common/mocks/fellowship-tracker-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
} from "@frt/api-contract/errors/tracking-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { MOCK_CONFIGURATION_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

function getBaseUrl(address: NetAddress.SocketAddress) {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return NetAddress.formatUrlUnsafe(hostAddress);
}

function startTrackingWith(startError: FellowshipTrackerStartError) {
  const fellowshipTrackerTest = makeFellowshipTrackerMock({
    start: () => {
      return E.fail(startError);
    },
  });

  return E.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;
    const baseUrl = getBaseUrl(httpServer.address);
    const payload = { configurationId: MOCK_CONFIGURATION_ID };

    const httpClient = yield* HttpClient.HttpClient;

    const response = yield* HttpClientRequest.post(`${baseUrl}/tracking`).pipe(
      HttpClientRequest.bodyJsonUnsafe(payload),
      httpClient.execute,
    );

    const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });
    const decodedError = yield* client.tracking
      .startTracking({ payload })
      .pipe(E.flip);

    return { decodedError, status: response.status };
  }).pipe(
    E.scoped,
    E.provide(
      Layer.mergeAll(
        makeApiServerTestLayerWith(fellowshipTrackerTest),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

describe("tracking routes", () => {
  test("POST /tracking responds 409 when tracking is already running", async () => {
    const { decodedError, status } = await startTrackingWith(
      new FellowshipTrackerAlreadyRunningError(),
    );

    expect(status).toBe(409);
    expect(decodedError).toBeInstanceOf(TrackingApiAlreadyRunningError);
    expect(decodedError.message).toBe("Tracking is already running.");
  });

  test("POST /tracking responds 404 when the configuration doesn't exist", async () => {
    const { decodedError, status } = await startTrackingWith(
      new FellowshipTrackerConfigurationNotFoundError({
        configurationId: MOCK_CONFIGURATION_ID,
      }),
    );

    expect(status).toBe(404);
    expect(decodedError).toBeInstanceOf(TrackingApiConfigurationNotFoundError);
    expect(decodedError).toMatchObject({
      configurationId: MOCK_CONFIGURATION_ID,
    });
  });
});
