import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, expect, test } from "vitest";

import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  FellowshipLogsGraphQLResponseError,
  FellowshipLogsRateLimitExceededError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeFellowshipLogsApiServiceMockOptions,
  makeFellowshipLogsApiServiceMock,
} from "@frt/api/tests/common/mocks/fellowship-logs-api-service-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  FellowshipLogsApiAlreadyImportedError,
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiRateLimitExceededError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { MOCK_DUNGEON_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsApiDungeonRunReferenceSchema } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

const MOCK_RUN = Schema.decodeSync(FellowshipLogsApiDungeonRunReferenceSchema)({
  fightId: 7,
  reportCode: "aBcD1234",
});

const QUEUE_PAYLOAD = {
  ...MOCK_RUN,
  dungeonId: MOCK_DUNGEON_ID,
  dungeonLevel: 10,
  isOwnRun: true,
};

const MOCK_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

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

  test("POST /fellowship-logs/dungeon-run-metadata responds 429 with the reset time when out of points", async () => {
    const resetsAt = DateTime.makeUnsafe("2026-09-23T09:00:00.000Z");

    const { decodedError, status } = await runWithFellowshipLogsApiService(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsRateLimitExceededError({
              reason: "PreflightExhausted",
              resetsAt,
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

    expect(status).toBe(429);
    expect(decodedError).toBeInstanceOf(
      FellowshipLogsApiRateLimitExceededError,
    );
    expect(decodedError).toMatchObject({
      resetsAtMilliseconds: DateTime.toEpochMillis(resetsAt),
    });
  });

  test("GET /fellowship-logs/rate-limit-data responds 429 when Fellowship Logs turns the lookup away", async () => {
    const resetsAt = DateTime.makeUnsafe("2026-09-23T09:00:00.000Z");

    const decodedError = await runWithFellowshipLogsApiService(
      {
        getRateLimitData: () => {
          return E.fail(
            new FellowshipLogsRateLimitExceededError({
              reason: "RejectedByApi",
              resetsAt,
            }),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          return yield* client.fellowshipLogs
            .getFellowshipLogsRateLimitData()
            .pipe(E.flip);
        });
      },
    );

    expect(decodedError).toBeInstanceOf(
      FellowshipLogsApiRateLimitExceededError,
    );
  });

  test("POST /fellowship-logs/import-jobs responds 202 with the queued job", async () => {
    const { body, status } = await runWithFellowshipLogsApiService(
      {},
      (baseUrl) => {
        return E.gen(function* () {
          const response = yield* postJson(
            `${baseUrl}/fellowship-logs/import-jobs`,
            QUEUE_PAYLOAD,
          );

          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          const decoded =
            yield* client.fellowshipLogs.queueFellowshipLogsDungeonRunImport({
              payload: QUEUE_PAYLOAD,
            });

          return { body: decoded, status: response.status };
        });
      },
    );

    expect(status).toBe(202);
    expect(body.wasAlreadyQueued).toBe(false);
    expect(body.job.status).toBe("QUEUED");
    expect(body.job.payload).toEqual(QUEUE_PAYLOAD);
  });

  test("POST /fellowship-logs/import-jobs responds 409 when the run was already imported", async () => {
    const { decodedError, status } = await runWithFellowshipLogsApiService(
      {
        queueDungeonRunImport: () => {
          return E.fail(
            new FellowshipLogsDungeonRunImportAlreadyImportedError({
              ...MOCK_RUN,
              dungeonRunId: MOCK_DUNGEON_RUN_ID,
            }),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const response = yield* postJson(
            `${baseUrl}/fellowship-logs/import-jobs`,
            QUEUE_PAYLOAD,
          );

          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          const error = yield* client.fellowshipLogs
            .queueFellowshipLogsDungeonRunImport({ payload: QUEUE_PAYLOAD })
            .pipe(E.flip);

          return { decodedError: error, status: response.status };
        });
      },
    );

    expect(status).toBe(409);
    expect(decodedError).toBeInstanceOf(FellowshipLogsApiAlreadyImportedError);
    expect(decodedError).toMatchObject({
      ...MOCK_RUN,
      dungeonRunId: MOCK_DUNGEON_RUN_ID,
    });
  });
});
