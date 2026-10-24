import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { FellowshipLogsAccessToken } from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  FellowshipLogsOAuthClient,
  type FellowshipLogsOAuthClientShape,
} from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
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
)("13100");
const CONNECTED_USER_NAME = Schema.decodeSync(
  FellowshipLogsConnectedUserNameSchema,
)("Player Name");
const ACCESS_TOKEN_LIFETIME_SECONDS = 31_104_000;
const encodeProtectedValue = Schema.encodeSync(ProtectedValueSchema);
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);

function makeProtectedValueStorage({
  requiresLocalFallbackAcknowledgement = false,
} = {}): ProtectedValueStorageShape {
  return {
    getProtectionStatus: () =>
      E.succeed({
        activeProtection: requiresLocalFallbackAcknowledgement
          ? "LOCAL_KEY"
          : "OS_BACKED",
        requiresLocalFallbackAcknowledgement,
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
}

type RefreshCall = {
  readonly clientId: string;
  readonly refreshToken: string;
};

function makeOAuthClient(
  refresh: (
    call: RefreshCall,
    index: number,
  ) => E.Effect<
    { readonly accessToken: string; readonly refreshToken: string },
    FellowshipLogsOAuthProviderError
  >,
) {
  const refreshCalls: Array<RefreshCall> = [];
  const client: FellowshipLogsOAuthClientShape = {
    checkClientCredentials: () => E.die("Unexpected client-credentials check."),
    exchangeCode: () => E.die("Unexpected code exchange."),
    getCurrentUser: () => E.die("Unexpected current-user request."),
    refreshTokens: (options) => {
      const call = {
        clientId: options.clientId,
        refreshToken: Redacted.value(options.refreshToken),
      };
      refreshCalls.push(call);

      return refresh(call, refreshCalls.length - 1).pipe(
        E.map((tokens) => {
          return {
            accessToken: Redacted.make(tokens.accessToken),
            expiresInSeconds: ACCESS_TOKEN_LIFETIME_SECONDS,
            refreshToken: Redacted.make(tokens.refreshToken),
          };
        }),
      );
    },
  };

  return { client, refreshCalls };
}

function makeTestLayer(
  oauthClient: FellowshipLogsOAuthClientShape,
  protectedValueStorage = makeProtectedValueStorage(),
) {
  const DAOsLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(Layer.provideMerge(makeMainDatabaseLayer(":memory:")));
  const ProtectedValueStorageLayer = Layer.succeed(
    ProtectedValueStorage,
    protectedValueStorage,
  );
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(DAOsLayer, NodeCrypto.layer, ProtectedValueStorageLayer),
    ),
  );
  const AccessTokenLayer = FellowshipLogsAccessToken.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        ConnectionLayer,
        ProtectedValueStorageLayer,
        Layer.succeed(FellowshipLogsOAuthClient, oauthClient),
      ),
    ),
  );

  return Layer.mergeAll(AccessTokenLayer, ConnectionLayer);
}

const saveSession = E.fnUntraced(function* ({
  accessToken = "access-token",
  expiresIn,
  refreshToken = "refresh-token",
}: {
  readonly accessToken?: string;
  readonly expiresIn: { readonly minutes: number };
  readonly refreshToken?: string | null;
}) {
  const connection = yield* FellowshipLogsConnection;
  const now = yield* DateTime.now;
  const current = yield* connection.getSummary();

  yield* connection.saveAuthorizedSession({
    accessToken: Redacted.make(accessToken),
    accessTokenExpiresAt: DateTime.add(now, expiresIn),
    allowLocalFallback: false,
    clientId: CLIENT_ID,
    connectedUserId: CONNECTED_USER_ID,
    connectedUserName: CONNECTED_USER_NAME,
    expectedGeneration: Option.match(current, {
      onNone: () => null,
      onSome: (value) => value.generation,
    }),
    profile: "FELLOWSHIP_RUN_TRACKER_USER",
    refreshToken: refreshToken === null ? null : Redacted.make(refreshToken),
  });
});

const getAccessToken = E.gen(function* () {
  const accessToken = yield* FellowshipLogsAccessToken;
  const value = yield* accessToken.get();

  return { ...value, accessToken: Redacted.value(value.accessToken) };
});

const readStoredSession = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const credentials = Option.getOrThrow(yield* connection.getCredentials());
  const summary = Option.getOrThrow(yield* connection.getSummary());

  if (credentials.profile === "OWN_CLIENT" || credentials.tokens === null) {
    return { summary, tokens: null };
  }

  return {
    summary,
    tokens: {
      accessToken: Redacted.value(credentials.tokens.accessToken),
      accessTokenExpiresAt: credentials.tokens.accessTokenExpiresAt,
      refreshToken:
        credentials.tokens.refreshToken === null
          ? null
          : Redacted.value(credentials.tokens.refreshToken),
    },
  };
});

const invalidGrant = new FellowshipLogsOAuthProviderError({
  operation: "RefreshTokens",
  providerError: "invalid_grant",
  reason: "Rejected",
  status: 400,
});

describe("FellowshipLogsAccessToken", () => {
  test("returns the stored access token without refreshing before expiry", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.die("Unexpected refresh."),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 60 } });

      return yield* getAccessToken;
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result).toEqual({
      accessToken: "access-token",
      clientId: CLIENT_ID,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(refreshCalls).toEqual([]);
  });

  test("refreshes an expiring token and stores both rotated tokens before using them", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.succeed({
        accessToken: "rotated-access-token",
        refreshToken: "rotated-refresh-token",
      }),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });
      const refreshed = yield* getAccessToken;
      const stored = yield* readStoredSession;
      const reused = yield* getAccessToken;
      const now = yield* DateTime.now;

      return { now, refreshed, reused, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(refreshCalls).toEqual([
      { clientId: CLIENT_ID, refreshToken: "refresh-token" },
    ]);
    expect(result.refreshed.accessToken).toBe("rotated-access-token");
    expect(result.reused.accessToken).toBe("rotated-access-token");
    expect(result.stored.summary).toMatchObject({
      connectedUserId: CONNECTED_USER_ID,
      connectedUserName: CONNECTED_USER_NAME,
      status: "CONNECTED",
    });
    expect(result.stored.tokens).toMatchObject({
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
    });
    expect(
      DateTime.isGreaterThan(
        result.stored.tokens?.accessTokenExpiresAt ?? result.now,
        DateTime.add(result.now, { days: 359 }),
      ),
    ).toBe(true);
  });

  test("stores the rotated tokens even when the caller is interrupted during the refresh", async () => {
    const refreshStarted = Deferred.makeUnsafe<void>();
    const releaseRefresh = Deferred.makeUnsafe<void>();
    const { client, refreshCalls } = makeOAuthClient(() =>
      Deferred.succeed(refreshStarted, undefined).pipe(
        E.andThen(Deferred.await(releaseRefresh)),
        E.as({
          accessToken: "rotated-access-token",
          refreshToken: "rotated-refresh-token",
        }),
      ),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });

      const caller = yield* getAccessToken.pipe(E.forkChild);

      yield* Deferred.await(refreshStarted);
      yield* Fiber.interrupt(caller);
      yield* Deferred.succeed(releaseRefresh, undefined);

      const next = yield* getAccessToken;
      const stored = yield* readStoredSession;

      return { next, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(refreshCalls).toHaveLength(1);
    expect(result.next.accessToken).toBe("rotated-access-token");
    expect(result.stored.tokens).toMatchObject({
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
    });
  });

  test("refreshes once when concurrent requests find an expiring token", async () => {
    const { client, refreshCalls } = makeOAuthClient((_, index) =>
      E.succeed({
        accessToken: `rotated-access-token-${index}`,
        refreshToken: `rotated-refresh-token-${index}`,
      }),
    );

    const results = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });

      return yield* E.all([getAccessToken, getAccessToken, getAccessToken], {
        concurrency: "unbounded",
      });
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(refreshCalls).toHaveLength(1);
    expect(results.map((result) => result.accessToken)).toEqual([
      "rotated-access-token-0",
      "rotated-access-token-0",
      "rotated-access-token-0",
    ]);
  });

  test("requires reauthorization when the refresh token is rejected", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.fail(invalidGrant),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });
      const rejected = yield* E.flip(getAccessToken);
      const stored = yield* readStoredSession;
      const repeated = yield* E.flip(getAccessToken);

      return { rejected, repeated, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.rejected).toMatchObject({
      _tag: "FellowshipLogsReauthorizationRequiredError",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
      reason: "RefreshTokenRejected",
    });
    expect(result.stored).toEqual({
      summary: expect.objectContaining({
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        status: "REAUTHORIZATION_REQUIRED",
      }),
      tokens: null,
    });
    expect(result.repeated).toMatchObject({
      _tag: "FellowshipLogsReauthorizationRequiredError",
      reason: "PreviouslyRequired",
    });
    expect(refreshCalls).toHaveLength(1);
  });

  test("keeps the session when the provider is unavailable during refresh", async () => {
    const { client } = makeOAuthClient(() =>
      E.fail(
        new FellowshipLogsOAuthProviderError({
          operation: "RefreshTokens",
          providerError: null,
          reason: "Unavailable",
          status: 503,
        }),
      ),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });
      const error = yield* E.flip(getAccessToken);
      const stored = yield* readStoredSession;

      return { error, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.error).toMatchObject({
      _tag: "FellowshipLogsOAuthProviderError",
      reason: "Unavailable",
    });
    expect(result.stored.summary.status).toBe("CONNECTED");
    expect(result.stored.tokens).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  test("keeps using a session without a refresh token until its access token expires", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.die("Unexpected refresh."),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 }, refreshToken: null });

      return yield* getAccessToken;
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.accessToken).toBe("access-token");
    expect(refreshCalls).toEqual([]);
  });

  test("requires reauthorization for an expired session without a refresh token", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.die("Unexpected refresh."),
    );

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: -1 }, refreshToken: null });
      const error = yield* E.flip(getAccessToken);
      const stored = yield* readStoredSession;

      return { error, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.error).toMatchObject({ reason: "NoRefreshToken" });
    expect(result.stored.summary.status).toBe("REAUTHORIZATION_REQUIRED");
    expect(refreshCalls).toEqual([]);
  });

  test("does not refresh when rotated tokens would need unacknowledged local protection", async () => {
    const { client, refreshCalls } = makeOAuthClient(() =>
      E.die("Unexpected refresh."),
    );

    const error = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });

      return yield* E.flip(getAccessToken);
    }).pipe(
      E.provide(
        makeTestLayer(
          client,
          makeProtectedValueStorage({
            requiresLocalFallbackAcknowledgement: true,
          }),
        ),
      ),
      runTest,
    );

    expect(error._tag).toBe("LocalProtectionAcknowledgementRequiredError");
    expect(refreshCalls).toEqual([]);
  });

  test("requires reauthorization when the current access token is rejected", async () => {
    const { client } = makeOAuthClient(() => E.die("Unexpected refresh."));

    const result = await E.gen(function* () {
      const accessToken = yield* FellowshipLogsAccessToken;

      yield* saveSession({ expiresIn: { minutes: 60 } });
      const error = yield* E.flip(
        accessToken.reportRejected(Redacted.make("access-token")),
      );
      const stored = yield* readStoredSession;

      return { error, stored };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.error).toMatchObject({
      _tag: "FellowshipLogsReauthorizationRequiredError",
      reason: "AccessTokenRejected",
    });
    expect(result.stored.summary.status).toBe("REAUTHORIZATION_REQUIRED");
    expect(result.stored.tokens).toBeNull();
  });

  test("ignores a rejection of an access token that a refresh already replaced", async () => {
    const { client } = makeOAuthClient(() =>
      E.succeed({
        accessToken: "rotated-access-token",
        refreshToken: "rotated-refresh-token",
      }),
    );

    const result = await E.gen(function* () {
      const accessToken = yield* FellowshipLogsAccessToken;

      yield* saveSession({ expiresIn: { minutes: 1 } });
      yield* getAccessToken;
      yield* accessToken.reportRejected(Redacted.make("access-token"));

      return yield* readStoredSession;
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.summary.status).toBe("CONNECTED");
    expect(result.tokens?.accessToken).toBe("rotated-access-token");
  });

  test("returns to connected after a new authorization", async () => {
    const { client } = makeOAuthClient(() => E.fail(invalidGrant));

    const result = await E.gen(function* () {
      yield* saveSession({ expiresIn: { minutes: 1 } });
      yield* E.flip(getAccessToken);
      yield* saveSession({
        accessToken: "new-access-token",
        expiresIn: { minutes: 60 },
        refreshToken: "new-refresh-token",
      });

      return {
        accessToken: yield* getAccessToken,
        stored: yield* readStoredSession,
      };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.accessToken.accessToken).toBe("new-access-token");
    expect(result.stored.summary.status).toBe("CONNECTED");
  });

  test("reports a missing or client-secret connection as having no signed-in session", async () => {
    const { client } = makeOAuthClient(() => E.die("Unexpected refresh."));

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const notConnected = yield* E.flip(getAccessToken);

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });

      return { clientSecret: yield* E.flip(getAccessToken), notConnected };
    }).pipe(E.provide(makeTestLayer(client)), runTest);

    expect(result.notConnected).toMatchObject({
      _tag: "FellowshipLogsNoSignedInSessionError",
      reason: "NotConnected",
    });
    expect(result.clientSecret).toMatchObject({
      _tag: "FellowshipLogsNoSignedInSessionError",
      reason: "ClientSecretConnection",
    });
  });
});
