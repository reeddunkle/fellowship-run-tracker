import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
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
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
  type FellowshipLogsConnectionGeneration,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)(
  "own-client-id",
);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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
    exchangeCode: () => E.die("Unexpected code exchange."),
    getCurrentUser: () => E.die("Unexpected current-user read."),
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
    ConnectionLayer.pipe(Layer.orDie),
    FetchHttpClient.layer,
  );
}

const makeClient = E.gen(function* () {
  const httpServer = yield* HttpServer.HttpServer;
  const client = yield* HttpApiClient.make(AppHttpApi, {
    baseUrl: getBaseUrl(httpServer.address),
  });

  return client.fellowshipLogsConnection;
});

const authorizeElsewhere = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const summary = yield* connection.getSummary();

  yield* connection.saveAuthorizedSession({
    accessToken: Redacted.make("newer-access-token"),
    accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
    allowLocalFallback: false,
    clientId: CLIENT_ID,
    connectedUserId: FellowshipLogsConnectedUserIdSchema.make("12345"),
    connectedUserName: FellowshipLogsConnectedUserNameSchema.make("Player"),
    expectedGeneration:
      summary._tag === "Some" ? summary.value.generation : null,
    profile: "OWN_CLIENT_USER",
    refreshToken: null,
  });
});

describe("fellowship logs connection generation", () => {
  test("returns an opaque generation that changes only when the connection is replaced", async () => {
    const result = await E.gen(function* () {
      const client = yield* makeClient;
      const saveOwnClient = (
        expectedGeneration: FellowshipLogsConnectionGeneration | null,
      ) =>
        client.saveFellowshipLogsOwnClient({
          payload: {
            allowLocalFallback: false,
            clientId: CLIENT_ID,
            clientSecret: Redacted.make("client-secret"),
            expectedGeneration,
            replaceConnection: false,
          },
        });

      const first = yield* saveOwnClient(null);
      const status = yield* client.getFellowshipLogsConnection();
      const second = yield* saveOwnClient(first.generation);

      return { first, second, status };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(result.first.generation).toMatch(UUID_PATTERN);
    expect(result.status.connection?.generation).toBe(result.first.generation);
    expect(result.second.generation).not.toBe(result.first.generation);
  });

  test("rejects saving an own client over a connection that changed after the user confirmed it", async () => {
    const result = await E.gen(function* () {
      const client = yield* makeClient;
      const payload = {
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        replaceConnection: true,
      };
      const confirmed = yield* client.saveFellowshipLogsOwnClient({
        payload: { ...payload, expectedGeneration: null },
      });

      yield* authorizeElsewhere;

      const error = yield* client
        .saveFellowshipLogsOwnClient({
          payload: { ...payload, expectedGeneration: confirmed.generation },
        })
        .pipe(E.flip);
      const status = yield* client.getFellowshipLogsConnection();

      return { error, status };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(result.error._tag).toBe("FellowshipLogsApiConnectionChangedError");
    expect(result.status.connection?.profile).toBe("OWN_CLIENT_USER");
  });

  test("rejects starting a sign-in over a connection that changed after the user confirmed it", async () => {
    const result = await E.gen(function* () {
      const client = yield* makeClient;

      yield* authorizeElsewhere;

      const error = yield* client
        .startFellowshipLogsAuthorization({
          payload: {
            allowLocalFallback: false,
            expectedGeneration: null,
            profile: "FELLOWSHIP_RUN_TRACKER_USER",
            replaceConnection: true,
          },
        })
        .pipe(E.flip);
      const status = yield* client.getFellowshipLogsConnection();

      return { error, status };
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(result.error._tag).toBe("FellowshipLogsApiConnectionChangedError");
    expect(result.status.authorization.state).toBe("IDLE");
    expect(result.status.connection?.profile).toBe("OWN_CLIENT_USER");
  });
});
