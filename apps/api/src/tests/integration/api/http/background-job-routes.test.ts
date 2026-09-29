import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { BackgroundJobQueueNotFoundError } from "@frt/api/errors/background-job-queue-error.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeBackgroundJobMockOptions,
  makeBackgroundJobMock,
} from "@frt/api/tests/common/mocks/background-job-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { BackgroundJobApiNotFoundError } from "@frt/api-contract/errors/background-job-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

const JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

function getBaseUrl(address: NetAddress.SocketAddress) {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return NetAddress.formatUrlUnsafe(hostAddress);
}

function runWithBackgroundJob<A, Error>(
  serviceOptions: MakeBackgroundJobMockOptions,
  program: (
    client: HttpApiClient.ForApi<typeof AppHttpApi>,
  ) => E.Effect<A, Error, HttpClient.HttpClient>,
) {
  return E.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;

    const client = yield* HttpApiClient.make(AppHttpApi, {
      baseUrl: getBaseUrl(httpServer.address),
    });

    return yield* program(client);
  }).pipe(
    E.scoped,
    E.provide(
      Layer.mergeAll(
        makeApiServerTestLayerWith(makeBackgroundJobMock(serviceOptions)),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

describe("background job routes", () => {
  test("GET /background-jobs returns the snapshot", async () => {
    const snapshot = await runWithBackgroundJob({}, (client) => {
      return client.backgroundJob.getBackgroundJobs();
    });

    expect(snapshot).toEqual({ jobs: [], revision: 0, sessionId: "test" });
  });

  test("POST /background-jobs/:jobId/cancel responds 404 for an unknown job", async () => {
    const error = await runWithBackgroundJob(
      {
        cancel: ({ id }) => {
          return E.fail(
            new BackgroundJobQueueNotFoundError({ id, operation: "Cancel" }),
          );
        },
      },
      (client) => {
        return client.backgroundJob
          .cancelBackgroundJob({ params: { jobId: JOB_ID } })
          .pipe(E.flip);
      },
    );

    expect(error).toBeInstanceOf(BackgroundJobApiNotFoundError);
    expect(error).toMatchObject({ id: JOB_ID });
  });
});
