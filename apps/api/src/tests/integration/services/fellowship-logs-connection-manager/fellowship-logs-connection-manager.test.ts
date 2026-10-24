import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsConnectionManager } from "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import {
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const CONNECTED_USER_ID = Schema.decodeSync(
  FellowshipLogsConnectedUserIdSchema,
)("user-id");
const CONNECTED_USER_NAME = Schema.decodeSync(
  FellowshipLogsConnectedUserNameSchema,
)("Player Name");
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

type DuringValidation = (
  connection: FellowshipLogsConnectionShape,
) => E.Effect<void, unknown>;

function makeTestLayer(
  duringValidation: DuringValidation,
  validationError: FellowshipLogsOAuthProviderError | null = null,
) {
  const DAOLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(Layer.provideMerge(makeMainDatabaseLayer(":memory:")));
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DAOLayer,
        NodeCrypto.layer,
        Layer.succeed(ProtectedValueStorage, OsBackedProtectedValueStorage),
      ),
    ),
  );
  const OAuthClientLayer = Layer.effect(
    FellowshipLogsOAuthClient,
    E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      return {
        checkClientCredentials: () =>
          duringValidation(connection).pipe(
            E.orDie,
            E.andThen(
              validationError === null ? E.void : E.fail(validationError),
            ),
          ),
        exchangeCode: () => E.die("Unexpected code exchange."),
        getCurrentUser: () => E.die("Unexpected current-user read."),
        refreshTokens: () => E.die("Unexpected refresh."),
      };
    }),
  ).pipe(Layer.provide(ConnectionLayer));
  const AuthorizationLayer = Layer.succeed(FellowshipLogsAuthorization, {
    abandon: () => E.die("Unexpected authorization abandon."),
    cancel: () => E.die("Unexpected authorization cancel."),
    complete: () => E.die("Unexpected authorization completion."),
    getStatus: () => E.succeed({ _tag: "Idle" }),
    start: () => E.die("Unexpected authorization start."),
    statusChanges: Stream.empty,
  });
  const PointSystemOptInLayer = Layer.succeed(FellowshipLogsPointSystemOptIn, {
    check: () => E.die("Unexpected point-system opt-in check."),
  });
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
    );

  return Layer.mergeAll(ConnectionManagerLayer, ConnectionLayer);
}

const getGeneration = (connection: FellowshipLogsConnectionShape) =>
  connection.getSummary().pipe(
    E.map(
      Option.match({
        onNone: () => null,
        onSome: (summary) => summary.generation,
      }),
    ),
  );

const saveOwnClientDirectly = (connection: FellowshipLogsConnectionShape) =>
  getGeneration(connection).pipe(
    E.flatMap((expectedGeneration) => {
      return connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("original-client-secret"),
        expectedGeneration,
      });
    }),
  );

const authorizeElsewhere = (connection: FellowshipLogsConnectionShape) =>
  getGeneration(connection).pipe(
    E.flatMap((expectedGeneration) => {
      return connection.saveAuthorizedSession({
        accessToken: Redacted.make("newer-access-token"),
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        connectedUserName: CONNECTED_USER_NAME,
        expectedGeneration,
        profile: "OWN_CLIENT_USER",
        refreshToken: Redacted.make("newer-refresh-token"),
      });
    }),
  );

const saveOwnClientThroughManager = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const manager = yield* FellowshipLogsConnectionManager;

  return yield* manager
    .saveOwnClient({
      allowLocalFallback: false,
      clientId: CLIENT_ID,
      clientSecret: Redacted.make("validated-client-secret"),
      expectedGeneration: yield* getGeneration(connection),
      replaceConnection: false,
    })
    .pipe(E.flip);
});

describe("FellowshipLogsConnectionManager", () => {
  test.each([
    { reason: "Rejected", status: 401 },
    { reason: "Unavailable", status: null },
  ] as const)(
    "keeps the current connection when credential validation is $reason",
    async ({ reason, status }) => {
      const validationError = new FellowshipLogsOAuthProviderError({
        operation: "CheckClientCredentials",
        providerError: null,
        reason,
        status,
      });
      const result = await E.gen(function* () {
        const connection = yield* FellowshipLogsConnection;

        yield* saveOwnClientDirectly(connection);
        const before = Option.getOrThrow(yield* connection.getSummary());
        const error = yield* saveOwnClientThroughManager;
        const credentials = Option.getOrThrow(
          yield* connection.getCredentials(),
        );

        return {
          after: Option.getOrThrow(yield* connection.getSummary()),
          before,
          error,
          storedSecret:
            credentials.profile === "OWN_CLIENT"
              ? Redacted.value(credentials.clientSecret)
              : null,
        };
      }).pipe(E.provide(makeTestLayer(() => E.void, validationError)), runTest);

      expect(result.error).toBe(validationError);
      expect(result.after).toEqual(result.before);
      expect(result.storedSecret).toBe("original-client-secret");
    },
  );

  test("keeps a connection that replaced the confirmed one during credential validation", async () => {
    let shouldReplace = false;

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* saveOwnClientDirectly(connection);
      shouldReplace = true;

      const error = yield* saveOwnClientThroughManager;

      return {
        error,
        summary: Option.getOrThrow(yield* connection.getSummary()),
      };
    }).pipe(
      E.provide(
        makeTestLayer((connection) => {
          return shouldReplace ? authorizeElsewhere(connection) : E.void;
        }),
      ),
      runTest,
    );

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(result.summary).toMatchObject({
      connectedUserId: CONNECTED_USER_ID,
      profile: "OWN_CLIENT_USER",
    });
  });

  test("keeps a connection installed during credential validation when none was observed", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const error = yield* saveOwnClientThroughManager;

      return {
        error,
        summary: Option.getOrThrow(yield* connection.getSummary()),
      };
    }).pipe(E.provide(makeTestLayer(authorizeElsewhere)), runTest);

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(result.summary.profile).toBe("OWN_CLIENT_USER");
  });

  test("stays disconnected when the confirmed connection is removed during credential validation", async () => {
    let shouldDisconnect = false;

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* saveOwnClientDirectly(connection);
      shouldDisconnect = true;

      const error = yield* saveOwnClientThroughManager;

      return { connection: yield* connection.getSummary(), error };
    }).pipe(
      E.provide(
        makeTestLayer((connection) => {
          return shouldDisconnect ? connection.disconnect() : E.void;
        }),
      ),
      runTest,
    );

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(Option.isNone(result.connection)).toBe(true);
  });
});
