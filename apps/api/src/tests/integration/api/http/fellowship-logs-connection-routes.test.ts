import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAuthorizationCallbackError } from "@frt/api/errors/fellowship-logs-authorization-error.ts";
import {
  FellowshipLogsConnectionChangedError,
  FellowshipLogsConnectionError,
  FellowshipLogsConnectionReplacementRequiredError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { FellowshipLogsGatewayAccessError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { getBaseUrl } from "@frt/api/tests/common/get-base-url.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeFellowshipLogsConnectionManagerMockOptions,
  makeFellowshipLogsConnectionManagerMock,
} from "@frt/api/tests/common/mocks/fellowship-logs-connection-manager-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  FellowshipLogsApiAuthorizationCallbackInvalidError,
  FellowshipLogsApiAuthorizationFailedError,
  FellowshipLogsApiAuthorizationNotPendingError,
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)(
  "own-client-id",
);
const CLIENT_SECRET = "own-client-secret-value";
const CALLBACK_URL =
  "http://127.0.0.1:49152/oauth/callback?code=authorization-code-value&state=state-value";

const OWN_CLIENT_PAYLOAD = {
  allowLocalFallback: false,
  clientId: CLIENT_ID,
  clientSecret: Redacted.make(CLIENT_SECRET),
  expectedGeneration: null,
  replaceConnection: false,
};

function runWithConnectionManager<A, Error>(
  serviceOptions: MakeFellowshipLogsConnectionManagerMockOptions,
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
          makeFellowshipLogsConnectionManagerMock(serviceOptions),
        ),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

const sendJson = E.fnUntraced(function* (
  method: "POST" | "PUT",
  url: string,
  body: unknown,
) {
  const httpClient = yield* HttpClient.HttpClient;
  const request =
    method === "POST"
      ? HttpClientRequest.post(url)
      : HttpClientRequest.put(url);
  const response = yield* request.pipe(
    HttpClientRequest.bodyJsonUnsafe(body),
    httpClient.execute,
  );

  return { body: yield* response.text, status: response.status };
});

describe("fellowship logs connection routes", () => {
  test("GET /fellowship-logs/connection responds with the connection and authorization status", async () => {
    const status = await runWithConnectionManager(
      {
        getStatus: () => {
          return E.succeed({
            authorization: {
              expiresAtMilliseconds: 1_000,
              profile: "FELLOWSHIP_RUN_TRACKER_USER",
              state: "PENDING",
            },
            connection: null,
          });
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          return yield* client.fellowshipLogsConnection.getFellowshipLogsConnection();
        });
      },
    );

    expect(status).toEqual({
      authorization: {
        expiresAtMilliseconds: 1_000,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        state: "PENDING",
      },
      connection: null,
    });
  });

  test("POST /fellowship-logs/connection/authorization responds 409 until replacing a different connection is confirmed", async () => {
    const { decodedError, status } = await runWithConnectionManager(
      {
        startAuthorization: () => {
          return E.fail(
            new FellowshipLogsConnectionReplacementRequiredError({
              currentProfile: "OWN_CLIENT",
            }),
          );
        },
      },
      (baseUrl) => {
        const payload = {
          allowLocalFallback: false,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          replaceConnection: false,
        } as const;

        return E.gen(function* () {
          const response = yield* sendJson(
            "POST",
            `${baseUrl}/fellowship-logs/connection/authorization`,
            payload,
          );
          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });
          const error = yield* client.fellowshipLogsConnection
            .startFellowshipLogsAuthorization({ payload })
            .pipe(E.flip);

          return { decodedError: error, status: response.status };
        });
      },
    );

    expect(status).toBe(409);
    expect(decodedError).toEqual(
      new FellowshipLogsApiConnectionReplacementConfirmationRequiredError({
        currentProfile: "OWN_CLIENT",
      }),
    );
  });

  test.each([
    {
      error: new FellowshipLogsAuthorizationCallbackError({
        reason: "Expired",
      }),
      expected: new FellowshipLogsApiAuthorizationNotPendingError({
        reason: "EXPIRED",
      }),
      status: 409,
    },
    {
      error: new FellowshipLogsAuthorizationCallbackError({
        reason: "NoPendingAuthorization",
      }),
      expected: new FellowshipLogsApiAuthorizationNotPendingError({
        reason: "NO_PENDING_AUTHORIZATION",
      }),
      status: 409,
    },
    {
      error: new FellowshipLogsAuthorizationCallbackError({
        reason: "StateMismatch",
      }),
      expected: new FellowshipLogsApiAuthorizationCallbackInvalidError({
        reason: "STATE_MISMATCH",
      }),
      status: 400,
    },
    {
      error: new FellowshipLogsOAuthProviderError({
        operation: "ExchangeCode",
        providerError: "invalid_grant",
        reason: "Rejected",
        status: 400,
      }),
      expected: new FellowshipLogsApiAuthorizationFailedError({
        failure: "PROVIDER_REJECTED",
      }),
      status: 502,
    },
    {
      error: new FellowshipLogsConnectionChangedError(),
      expected: new FellowshipLogsApiConnectionChangedError(),
      status: 409,
    },
  ])(
    "POST /fellowship-logs/connection/authorization/callback maps $error._tag to $expected._tag",
    async ({ error, expected, status: expectedStatus }) => {
      const { body, decodedError, status } = await runWithConnectionManager(
        {
          completeAuthorization: () => {
            return E.fail(error);
          },
        },
        (baseUrl) => {
          return E.gen(function* () {
            const response = yield* sendJson(
              "POST",
              `${baseUrl}/fellowship-logs/connection/authorization/callback`,
              { callbackUrl: CALLBACK_URL },
            );
            const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });
            const decoded = yield* client.fellowshipLogsConnection
              .completeFellowshipLogsAuthorization({
                payload: { callbackUrl: Redacted.make(CALLBACK_URL) },
              })
              .pipe(E.flip);

            return { ...response, decodedError: decoded };
          });
        },
      );

      expect(status).toBe(expectedStatus);
      expect(decodedError).toEqual(expected);
      expect(body).not.toContain("authorization-code-value");
      expect(body).not.toContain("invalid_grant");
    },
  );

  test("PUT /fellowship-logs/connection/own-client responds 422 when Fellowship Logs rejects the credentials", async () => {
    const { body, decodedError, status } = await runWithConnectionManager(
      {
        saveOwnClient: () => {
          return E.fail(
            new FellowshipLogsOAuthProviderError({
              operation: "CheckClientCredentials",
              providerError: "invalid_client",
              reason: "Rejected",
              status: 401,
            }),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const response = yield* sendJson(
            "PUT",
            `${baseUrl}/fellowship-logs/connection/own-client`,
            { ...OWN_CLIENT_PAYLOAD, clientSecret: CLIENT_SECRET },
          );
          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });
          const decoded = yield* client.fellowshipLogsConnection
            .saveFellowshipLogsOwnClient({ payload: OWN_CLIENT_PAYLOAD })
            .pipe(E.flip);

          return { ...response, decodedError: decoded };
        });
      },
    );

    expect(status).toBe(422);
    expect(decodedError).toEqual(
      new FellowshipLogsApiInvalidCredentialsError(),
    );
    expect(body).not.toContain(CLIENT_SECRET);
  });

  test("PUT /fellowship-logs/connection/own-client hides storage failure causes", async () => {
    const { body, status } = await runWithConnectionManager(
      {
        saveOwnClient: ({ clientSecret }) => {
          return E.fail(
            new FellowshipLogsConnectionError({
              cause: `could not store ${Redacted.value(clientSecret)}`,
              operation: "Save",
            }),
          );
        },
      },
      (baseUrl) => {
        return sendJson(
          "PUT",
          `${baseUrl}/fellowship-logs/connection/own-client`,
          { ...OWN_CLIENT_PAYLOAD, clientSecret: CLIENT_SECRET },
        );
      },
    );

    expect(status).toBe(500);
    expect(body).toBe("");
  });

  test("POST /fellowship-logs/connection/point-system-opt-in-check responds 409 when the session needs reauthorization", async () => {
    const decodedError = await runWithConnectionManager(
      {
        checkPointSystemOptIn: () => {
          return E.fail(
            new FellowshipLogsGatewayAccessError({
              cause: null,
              reason: "ReauthorizationRequired",
            }),
          );
        },
      },
      (baseUrl) => {
        return E.gen(function* () {
          const client = yield* HttpApiClient.make(AppHttpApi, { baseUrl });

          return yield* client.fellowshipLogsConnection
            .checkFellowshipLogsPointSystemOptIn()
            .pipe(E.flip);
        });
      },
    );

    expect(decodedError).toEqual(
      new FellowshipLogsApiConnectionRequiredError({
        reason: "REAUTHORIZATION_REQUIRED",
      }),
    );
  });
});
