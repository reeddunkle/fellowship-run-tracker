import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ConfigProvider from "effect/ConfigProvider";
import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { SystemBrowserError } from "@frt/api/errors/system-browser-error.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsConnectionManager } from "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import {
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";
import { getBaseUrl } from "@frt/api/tests/common/get-base-url.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import {
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_SECRET = "own-client-secret-value";
const ACCESS_TOKEN = "access-token-value";
const REFRESH_TOKEN = "refresh-token-value";
const AUTHORIZATION_CODE = "authorization-code-value";

const SENSITIVE_VALUES = [
  ACCESS_TOKEN,
  AUTHORIZATION_CODE,
  CLIENT_SECRET,
  REFRESH_TOKEN,
];

const encodeProtectedValue = Schema.encodeSync(ProtectedValueSchema);
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);

const OsBackedProtectedValueStorage: ProtectedValueStorageShape = {
  getProtectionStatus: () =>
    E.succeed({
      activeProtection: "OS_BACKED",
      requiresLocalFallbackAcknowledgement: false,
    }),
  protect: (value) =>
    E.succeed(
      encodeProtectedValue({
        protection: "OS_BACKED",
        value: Buffer.from(Redacted.value(value)).toString("base64url"),
        version: 1,
      }),
    ),
  unprotect: (value) =>
    E.succeed(
      Redacted.make(
        Buffer.from(decodeProtectedValue(value).value, "base64url").toString(
          "utf8",
        ),
      ),
    ),
};

function makeTestLayer() {
  const DAOLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(Layer.provideMerge(makeMainDatabaseLayer(":memory:")));
  const ProtectedValueStorageLayer = Layer.succeed(
    ProtectedValueStorage,
    OsBackedProtectedValueStorage,
  );
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(DAOLayer, NodeCrypto.layer, ProtectedValueStorageLayer),
    ),
  );
  const OAuthClientLayer = Layer.succeed(FellowshipLogsOAuthClient, {
    checkClientCredentials: () => E.void,
    exchangeCode: () =>
      E.succeed({
        accessToken: Redacted.make(ACCESS_TOKEN),
        expiresInSeconds: 31_104_000,
        refreshToken: Redacted.make(REFRESH_TOKEN),
      }),
    getCurrentUser: () =>
      E.succeed({
        id: FellowshipLogsConnectedUserIdSchema.make("12345"),
        name: FellowshipLogsConnectedUserNameSchema.make("Player Name"),
      }),
    refreshTokens: () => E.die("Unexpected refresh."),
  });
  const PointSystemOptInLayer = Layer.succeed(FellowshipLogsPointSystemOptIn, {
    check: () => E.succeed("OPTED_IN"),
  });
  const AuthorizationLayer = FellowshipLogsAuthorization.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DAOLayer,
        ConnectionLayer,
        ProtectedValueStorageLayer,
        OAuthClientLayer,
        PointSystemOptInLayer,
        Layer.succeed(SystemBrowser, {
          open: () => E.fail(new SystemBrowserError({ reason: "Unavailable" })),
        }),
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            FELLOWSHIP_LOGS_OAUTH_CLIENT_ID: "fellowship-run-tracker-client-id",
          }),
        ),
      ),
    ),
  );
  const ConnectionManagerLayer =
    FellowshipLogsConnectionManager.layerNoDeps.pipe(
      Layer.provide(
        Layer.mergeAll(
          AuthorizationLayer,
          ConnectionLayer,
          OAuthClientLayer,
          PointSystemOptInLayer,
        ),
      ),
      Layer.orDie,
    );

  return Layer.mergeAll(
    makeApiServerTestLayerWith(ConnectionManagerLayer),
    DAOLayer.pipe(Layer.orDie),
    FetchHttpClient.layer,
  );
}

const request = E.fnUntraced(function* (
  method: "DELETE" | "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
) {
  const httpClient = yield* HttpClient.HttpClient;
  const httpServer = yield* HttpServer.HttpServer;
  const url = `${getBaseUrl(httpServer.address)}${path}`;
  const baseRequest = HttpClientRequest.make(method)(url);
  const response = yield* httpClient.execute(
    body === undefined
      ? baseRequest
      : baseRequest.pipe(HttpClientRequest.bodyJsonUnsafe(body)),
  );

  return { body: yield* response.text, status: response.status };
});

function expectNoSensitiveValues(body: string) {
  for (const value of SENSITIVE_VALUES) {
    expect(body).not.toContain(value);
  }
}

describe("fellowship logs connection redaction", () => {
  test("saving own-client credentials never returns the client secret", async () => {
    const responses = await E.gen(function* () {
      const saved = yield* request(
        "PUT",
        "/fellowship-logs/connection/own-client",
        {
          allowLocalFallback: false,
          clientId: "own-client-id",
          clientSecret: CLIENT_SECRET,
          expectedGeneration: null,
          replaceConnection: false,
        },
      );
      const status = yield* request("GET", "/fellowship-logs/connection");

      return { saved, status };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(responses.saved.status).toBe(200);
    expect(JSON.parse(responses.saved.body)).toMatchObject({
      clientId: "own-client-id",
      profile: "OWN_CLIENT",
      spending: "DEFAULT",
      status: "CONNECTED",
    });
    expectNoSensitiveValues(responses.saved.body);
    expectNoSensitiveValues(responses.status.body);
  });

  test("authorization responses never return the code or session tokens", async () => {
    const responses = await E.gen(function* () {
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const started = yield* request(
        "POST",
        "/fellowship-logs/connection/authorization",
        {
          allowLocalFallback: false,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          replaceConnection: false,
        },
      );
      const transaction = Option.getOrThrow(yield* transactionDAO.get());
      const callbackUrl = (state: string) => {
        const url = new URL(transaction.redirectUri);

        url.searchParams.set("code", AUTHORIZATION_CODE);
        url.searchParams.set("state", state);

        return url.toString();
      };
      const mismatched = yield* request(
        "POST",
        "/fellowship-logs/connection/authorization/callback",
        { callbackUrl: callbackUrl("another-state") },
      );
      const completed = yield* request(
        "POST",
        "/fellowship-logs/connection/authorization/callback",
        { callbackUrl: callbackUrl(transaction.state) },
      );
      const status = yield* request("GET", "/fellowship-logs/connection");

      return { completed, mismatched, started, status };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(JSON.parse(responses.started.body)).toMatchObject({
      browserLaunch: "UNAVAILABLE",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(responses.mismatched.status).toBe(400);
    expect(JSON.parse(responses.completed.body)).toEqual({
      connectedUserName: "Player Name",
      pointSystemOptIn: "OPTED_IN",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
      state: "CONNECTED",
    });
    expect(JSON.parse(responses.status.body)).toMatchObject({
      connection: {
        clientId: null,
        connectedUserName: "Player Name",
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        spending: "USER_POINTS_ONLY",
        status: "CONNECTED",
      },
    });

    for (const response of Object.values(responses)) {
      expectNoSensitiveValues(response.body);
    }
  });

  test("starting a different profile while connected requires confirmation", async () => {
    const responses = await E.gen(function* () {
      const saved = yield* request(
        "PUT",
        "/fellowship-logs/connection/own-client",
        {
          allowLocalFallback: false,
          clientId: "own-client-id",
          clientSecret: CLIENT_SECRET,
          expectedGeneration: null,
          replaceConnection: false,
        },
      );

      const payload = {
        allowLocalFallback: false,
        expectedGeneration: JSON.parse(saved.body).generation,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      };
      const unconfirmed = yield* request(
        "POST",
        "/fellowship-logs/connection/authorization",
        { ...payload, replaceConnection: false },
      );
      const confirmed = yield* request(
        "POST",
        "/fellowship-logs/connection/authorization",
        { ...payload, replaceConnection: true },
      );

      return { confirmed, unconfirmed };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(responses.unconfirmed.status).toBe(409);
    expect(JSON.parse(responses.unconfirmed.body)).toMatchObject({
      _tag: "FellowshipLogsApiConnectionReplacementConfirmationRequiredError",
      currentProfile: "OWN_CLIENT",
    });
    expect(responses.confirmed.status).toBe(200);
  });
});
