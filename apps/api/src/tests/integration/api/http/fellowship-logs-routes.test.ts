import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { BackgroundJobQueueNotFoundError } from "@frt/api/errors/background-job-queue-error.ts";
import { FellowshipLogsNotConnectedError } from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayGraphQLResponseError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRateLimitExceededError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { getBaseUrl } from "@frt/api/tests/common/get-base-url.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeFellowshipLogsMockOptions,
  makeFellowshipLogsMock,
} from "@frt/api/tests/common/mocks/fellowship-logs-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  FellowshipLogsApiAlreadyImportedError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
  FellowshipLogsApiOperationUnavailableError,
  FellowshipLogsApiPointSystemOptInRequiredError,
  FellowshipLogsApiRateLimitExceededError,
  FellowshipLogsApiReportAccessDeniedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { MOCK_DUNGEON_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
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

const MOCK_JOB_ID = Schema.decodeSync(BackgroundJobIdSchema)(
  "00000000-0000-7000-8000-000000000001",
);

const MOCK_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

const postJson = E.fnUntraced(function* (url: string, body: unknown) {
  const httpClient = yield* HttpClient.HttpClient;

  return yield* HttpClientRequest.post(url).pipe(
    HttpClientRequest.bodyJsonUnsafe(body),
    httpClient.execute,
  );
});

function runWithFellowshipLogs<A, Error>(
  serviceOptions: MakeFellowshipLogsMockOptions,
  program: (baseUrl: string) => E.Effect<A, Error, HttpClient.HttpClient>,
) {
  return E.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;

    return yield* program(getBaseUrl(httpServer.address));
  }).pipe(
    E.scoped,
    E.provide(
      Layer.mergeAll(
        makeApiServerTestLayerWith(makeFellowshipLogsMock(serviceOptions)),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

describe("fellowship logs routes", () => {
  test("POST /fellowship-logs/dungeon-run-metadata responds 403 when the connection cannot view the report", async () => {
    const { decodedError, status } = await runWithFellowshipLogs(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGatewayGraphQLResponseError({
              errors: [
                {
                  message: "You do not have permission to view this report.",
                },
              ],
              reason: "ErrorsReturned",
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

    expect(status).toBe(403);
    expect(decodedError).toBeInstanceOf(
      FellowshipLogsApiReportAccessDeniedError,
    );
    expect(decodedError).toMatchObject(MOCK_RUN);
  });

  test("POST /fellowship-logs/dungeon-run-metadata responds 404 when the report is missing", async () => {
    const { decodedError, status } = await runWithFellowshipLogs(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGatewayGraphQLResponseError({
              errors: [],
              reason: "ReportNotFound",
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

    expect(status).toBe(404);
    expect(decodedError).toBeInstanceOf(FellowshipLogsApiRunNotFoundError);
    expect(decodedError).toMatchObject(MOCK_RUN);
  });

  test("POST /fellowship-logs/dungeon-run-metadata responds 422 when the fight has no dungeon level", async () => {
    const { decodedError, status } = await runWithFellowshipLogs(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGatewayGraphQLResponseError({
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

    const { decodedError, status } = await runWithFellowshipLogs(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
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
      reason: "APPLICATION_POINTS_EXHAUSTED",
      resetsAtMilliseconds: DateTime.toEpochMillis(resetsAt),
    });
  });

  test.each([
    {
      expected: new FellowshipLogsApiConnectionRequiredError({
        reason: "NOT_CONNECTED",
      }),
      gatewayError: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "NotConnected",
      }),
      status: 409,
    },
    {
      expected: new FellowshipLogsApiConnectionRequiredError({
        reason: "REAUTHORIZATION_REQUIRED",
      }),
      gatewayError: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "ReauthorizationRequired",
      }),
      status: 409,
    },
    {
      expected:
        new FellowshipLogsApiLocalProtectionAcknowledgementRequiredError(),
      gatewayError: new FellowshipLogsGatewayAccessError({
        cause: null,
        reason: "LocalProtectionAcknowledgementRequired",
      }),
      status: 409,
    },
    {
      expected: new FellowshipLogsApiPointSystemOptInRequiredError(),
      gatewayError: new FellowshipLogsGatewayPointPolicyError({
        reason: "PointSystemOptInRequired",
      }),
      status: 409,
    },
    {
      expected: new FellowshipLogsApiOperationUnavailableError({
        reason: "NOT_USER_ELIGIBLE",
      }),
      gatewayError: new FellowshipLogsGatewayPointPolicyError({
        reason: "NotUserEligible",
      }),
      status: 422,
    },
    {
      expected: new FellowshipLogsApiOperationUnavailableError({
        reason: "NON_USER_POINTS_REQUIRED",
      }),
      gatewayError: new FellowshipLogsGatewayPointPolicyError({
        reason: "NonUserPointsRequired",
      }),
      status: 422,
    },
    {
      expected: new FellowshipLogsApiRateLimitExceededError({
        reason: "USER_POINTS_EXHAUSTED",
        resetsAtMilliseconds: 1_000,
      }),
      gatewayError: new FellowshipLogsGatewayRateLimitExceededError({
        reason: "UserPointsExhausted",
        resetsAt: DateTime.makeUnsafe(1_000),
      }),
      status: 429,
    },
    {
      expected: new FellowshipLogsApiRateLimitExceededError({
        reason: "USER_POINTS_EXHAUSTED",
        resetsAtMilliseconds: 1_000,
      }),
      gatewayError: new FellowshipLogsGatewayRateLimitExceededError({
        reason: "UserPointsRejectedByApi",
        resetsAt: DateTime.makeUnsafe(1_000),
      }),
      status: 429,
    },
    {
      expected: new FellowshipLogsApiRateLimitExceededError({
        reason: "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
        resetsAtMilliseconds: 1_000,
      }),
      gatewayError: new FellowshipLogsGatewayRateLimitExceededError({
        reason: "ApplicationHoldUnavailable",
        resetsAt: DateTime.makeUnsafe(1_000),
      }),
      status: 429,
    },
  ])(
    "POST /fellowship-logs/dungeon-run-metadata maps $gatewayError._tag $gatewayError.reason to $expected._tag",
    async ({ expected, gatewayError, status: expectedStatus }) => {
      const { decodedError, status } = await runWithFellowshipLogs(
        {
          getDungeonRunMetadata: () => {
            return E.fail(gatewayError);
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

      expect(status).toBe(expectedStatus);
      expect(decodedError).toEqual(expected);
    },
  );

  test("POST /fellowship-logs/dungeon-run-metadata treats a query that can't be limited to user points as an internal failure", async () => {
    const status = await runWithFellowshipLogs(
      {
        getDungeonRunMetadata: () => {
          return E.fail(
            new FellowshipLogsGatewayPointPolicyError({
              reason: "DirectiveNotApplicable",
            }),
          );
        },
      },
      (baseUrl) => {
        return postJson(
          `${baseUrl}/fellowship-logs/dungeon-run-metadata`,
          MOCK_RUN,
        ).pipe(E.map((response) => response.status));
      },
    );

    expect(status).toBe(500);
  });

  test("GET /fellowship-logs/rate-limit-data responds 429 when Fellowship Logs turns the lookup away", async () => {
    const resetsAt = DateTime.makeUnsafe("2026-09-23T09:00:00.000Z");

    const decodedError = await runWithFellowshipLogs(
      {
        getRateLimitData: () => {
          return E.fail(
            new FellowshipLogsGatewayRateLimitExceededError({
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
    const { body, status } = await runWithFellowshipLogs(
      {
        queueDungeonRunImport: (options) => {
          return E.succeed({
            job: {
              attempts: 0,
              availableAtMilliseconds: null,
              createdAtMilliseconds: 0,
              error: null,
              finishedAtMilliseconds: null,
              id: MOCK_JOB_ID,
              kind: "ImportFellowshipLogsDungeonRun",
              payload: options,
              progress: null,
              result: null,
              startedAtMilliseconds: null,
              status: "QUEUED",
              waitingReason: null,
            },
            wasAlreadyQueued: false,
          });
        },
      },
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
    const { decodedError, status } = await runWithFellowshipLogs(
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

  test("POST /fellowship-logs/import-jobs responds 409 while disconnected", async () => {
    const { decodedError, status } = await runWithFellowshipLogs(
      {
        queueDungeonRunImport: () => {
          return E.fail(new FellowshipLogsNotConnectedError());
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
    expect(decodedError).toEqual(
      new FellowshipLogsApiConnectionRequiredError({ reason: "NOT_CONNECTED" }),
    );
  });

  test.each([
    {
      error: new BackgroundJobQueueNotFoundError({
        id: MOCK_JOB_ID,
        operation: "Resume",
      }),
      status: 404,
    },
    { error: new FellowshipLogsNotConnectedError(), status: 409 },
  ])(
    "POST /fellowship-logs/import-jobs/:jobId/resume-with-current-connection maps $error._tag to $status",
    async ({ error, status: expectedStatus }) => {
      const status = await runWithFellowshipLogs(
        {
          resumeImportJobWithCurrentConnection: () => {
            return E.fail(error);
          },
        },
        (baseUrl) => {
          return postJson(
            `${baseUrl}/fellowship-logs/import-jobs/${MOCK_JOB_ID}/resume-with-current-connection`,
            {},
          ).pipe(
            E.map((response) => {
              return response.status;
            }),
          );
        },
      );

      expect(status).toBe(expectedStatus);
    },
  );
});
