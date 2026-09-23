import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImportDungeonLevelNotFoundError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { FellowshipLogsGraphQLResponseError } from "@frt/api/errors/fellowship-logs-error.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeFellowshipLogsApiServiceMockOptions,
  makeFellowshipLogsApiServiceMock,
} from "@frt/api/tests/common/mocks/fellowship-logs-api-service-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsApiDungeonLevelNotFoundError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { FellowshipLogsApiDungeonRunReferenceSchema } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

const MOCK_RUN = Schema.decodeSync(FellowshipLogsApiDungeonRunReferenceSchema)({
  fightId: 7,
  reportCode: "aBcD1234",
});

function getBaseUrl(address: HttpServer.Address) {
  if (address._tag === "UnixAddress") {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `http://${hostname}:${address.port}`;
}

function postJson(url: string, body: unknown) {
  return E.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    return yield* HttpClientRequest.post(url).pipe(
      HttpClientRequest.bodyJsonUnsafe(body),
      httpClient.execute,
    );
  });
}

function runWithFellowshipLogsApiService<A, Error>(
  serviceOptions: MakeFellowshipLogsApiServiceMockOptions,
  program: (baseUrl: string) => E.Effect<A, Error, HttpClient.HttpClient>,
) {
  return E.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;

    return yield* program(getBaseUrl(httpServer.address));
  }).pipe(
    E.scoped,
    E.provide(
      Layer.mergeAll(
        makeApiServerTestLayerWith(
          makeFellowshipLogsApiServiceMock(serviceOptions),
        ),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

describe("fellowship logs routes", () => {
  test("POST /fellowship-logs/dungeon-run-metadata responds 422 when the fight has no dungeon level", async () => {
    const { decodedError, status } = await runWithFellowshipLogsApiService(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGraphQLResponseError({
              errors: [],
              fightId: MOCK_RUN.fightId,
              reason: "FightMissingDifficultyLevel",
              reportCode: MOCK_RUN.reportCode,
            }),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const response = yield* postJson(
            `${baseUrl}/fellowship-logs/dungeon-run-metadata`,
            MOCK_RUN,
          );

          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          const error = yield* client.fellowshipLogs
            .getFellowshipLogsDungeonRunMetadata({ payload: MOCK_RUN })
            .pipe(E.flip);

          return { decodedError: error, status: response.status };
        });
      },
    );

    expect(status).toBe(422);
    expect(decodedError).toBeInstanceOf(
      FellowshipLogsApiDungeonLevelNotFoundError,
    );
    expect(decodedError).toMatchObject(MOCK_RUN);
  });

  test("POST /fellowship-logs/dungeon-runs responds 422 when the run has no dungeon level", async () => {
    const payload = { ...MOCK_RUN, isOwnRun: true };

    const { decodedError, status } = await runWithFellowshipLogsApiService(
      {
        importDungeonRun: () => {
          return E.fail(
            new FellowshipLogsDungeonRunImportDungeonLevelNotFoundError(
              MOCK_RUN,
            ),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const response = yield* postJson(
            `${baseUrl}/fellowship-logs/dungeon-runs`,
            payload,
          );

          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          const error = yield* client.fellowshipLogs
            .importFellowshipLogsDungeonRun({ payload })
            .pipe(E.flip);

          return { decodedError: error, status: response.status };
        });
      },
    );

    expect(status).toBe(422);
    expect(decodedError).toBeInstanceOf(
      FellowshipLogsApiDungeonLevelNotFoundError,
    );
    expect(decodedError.message).toBe(
      "This run doesn't have a dungeon level, so it can't be imported.",
    );
  });
});
