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
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsConnection,
  type FellowshipLogsCredentials,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
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
  type FellowshipLogsConnectionGeneration,
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const CONNECTED_USER_ID = Schema.decodeSync(
  FellowshipLogsConnectedUserIdSchema,
)("user-id");
const OTHER_USER_ID = Schema.decodeSync(FellowshipLogsConnectedUserIdSchema)(
  "other-user-id",
);
const CONNECTED_USER_NAME = Schema.decodeSync(
  FellowshipLogsConnectedUserNameSchema,
)("Player Name");
const OAUTH_STATE = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");
const REDIRECT_URI = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
  "https://auth.example.com/oauth/callback",
);
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

const MainDatabaseLayer = makeMainDatabaseLayer(":memory:");
const DAOsLayer = Layer.mergeAll(
  FellowshipLogsAuthorizationTransactionDAO.layer,
  FellowshipLogsConnectionDAO.layer,
).pipe(Layer.provideMerge(MainDatabaseLayer));
const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DAOsLayer,
      NodeCrypto.layer,
      Layer.succeed(ProtectedValueStorage, OsBackedProtectedValueStorage),
    ),
  ),
);
const TestLayer = Layer.merge(DAOsLayer, ConnectionLayer);

function revealCredentials(credentials: FellowshipLogsCredentials) {
  return credentials.profile === "OWN_CLIENT"
    ? {
        ...credentials,
        clientSecret: Redacted.value(credentials.clientSecret),
      }
    : {
        ...credentials,
        tokens:
          credentials.tokens === null
            ? null
            : {
                ...credentials.tokens,
                accessToken: Redacted.value(credentials.tokens.accessToken),
                refreshToken:
                  credentials.tokens.refreshToken === null
                    ? null
                    : Redacted.value(credentials.tokens.refreshToken),
              },
      };
}

describe("FellowshipLogsConnection", () => {
  test("announces each saved or removed connection", async () => {
    const revisions = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const initial = yield* connection.changes.pipe(Stream.runHead);

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });

      const afterSave = yield* connection.changes.pipe(Stream.runHead);

      yield* connection.disconnect();

      const afterDisconnect = yield* connection.changes.pipe(Stream.runHead);

      return [initial, afterSave, afterDisconnect].map(Option.getOrThrow);
    }).pipe(E.provide(TestLayer), runTest);

    expect(revisions).toEqual([0, 1, 2]);
  });

  test("waits for in-flight requests before disconnecting, and holds new requests until it finishes", async () => {
    const events = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const log: Array<string> = [];
      const releaseRequest = yield* Deferred.make<void>();
      const requestStarted = yield* Deferred.make<void>();

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });

      const inFlight = yield* connection
        .withRequestLease(
          Deferred.succeed(requestStarted, undefined).pipe(
            E.andThen(Deferred.await(releaseRequest)),
            E.andThen(
              E.sync(() => {
                log.push("first request finished");
              }),
            ),
          ),
        )
        .pipe(E.forkChild);

      yield* Deferred.await(requestStarted);

      const disconnecting = yield* connection.disconnect().pipe(
        E.andThen(
          E.sync(() => {
            log.push("disconnected");
          }),
        ),
        E.forkChild,
      );

      yield* E.sleep("50 millis");

      const laterRequest = yield* connection
        .withRequestLease(
          connection.getSummary().pipe(
            E.tap((summary) => {
              return E.sync(() => {
                log.push(
                  `later request saw ${Option.isSome(summary) ? "a connection" : "no connection"}`,
                );
              });
            }),
          ),
        )
        .pipe(E.forkChild);

      yield* E.sleep("50 millis");
      log.push("releasing first request");
      yield* Deferred.succeed(releaseRequest, undefined);
      yield* Fiber.join(inFlight);
      yield* Fiber.join(disconnecting);
      yield* Fiber.join(laterRequest);

      return log;
    }).pipe(E.provide(TestLayer), runTest);

    expect(events).toEqual([
      "releasing first request",
      "first request finished",
      "disconnected",
      "later request saw no connection",
    ]);
  });

  test("waits for in-flight requests before replacing, and holds new requests until it finishes", async () => {
    const events = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const log: Array<string> = [];
      const releaseRequest = yield* Deferred.make<void>();
      const requestStarted = yield* Deferred.make<void>();

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("original-client-secret"),
        expectedGeneration: null,
      });
      const expectedGeneration = Option.getOrThrow(
        yield* connection.getSummary(),
      ).generation;

      const inFlight = yield* connection
        .withRequestLease(
          Deferred.succeed(requestStarted, undefined).pipe(
            E.andThen(Deferred.await(releaseRequest)),
            E.andThen(
              E.sync(() => {
                log.push("first request finished");
              }),
            ),
          ),
        )
        .pipe(E.forkChild);

      yield* Deferred.await(requestStarted);

      const replacing = yield* connection
        .saveOwnClient({
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          clientSecret: Redacted.make("replacement-client-secret"),
          expectedGeneration,
        })
        .pipe(
          E.andThen(
            E.sync(() => {
              log.push("replaced");
            }),
          ),
          E.forkChild,
        );

      yield* E.sleep("50 millis");

      const laterRequest = yield* connection
        .withRequestLease(
          connection.getCredentials().pipe(
            E.tap((credentials) => {
              return E.sync(() => {
                const value = Option.getOrThrow(credentials);
                const secret =
                  value.profile === "OWN_CLIENT"
                    ? Redacted.value(value.clientSecret)
                    : "unexpected profile";

                log.push(`later request saw ${secret}`);
              });
            }),
          ),
        )
        .pipe(E.forkChild);

      yield* E.sleep("50 millis");
      log.push("releasing first request");
      yield* Deferred.succeed(releaseRequest, undefined);
      yield* Fiber.join(inFlight);
      yield* Fiber.join(replacing);
      yield* Fiber.join(laterRequest);

      return log;
    }).pipe(E.provide(TestLayer), runTest);

    expect(events).toEqual([
      "releasing first request",
      "first request finished",
      "replaced",
      "later request saw replacement-client-secret",
    ]);
  });

  test("saves and reads an own-client connection", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });

      return {
        credentials: Option.getOrThrow(yield* connection.getCredentials()),
        summary: Option.getOrThrow(yield* connection.getSummary()),
      };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.summary).toEqual({
      clientId: CLIENT_ID,
      connectedUserId: null,
      connectedUserName: null,
      generation: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      pointPolicyVersion: "2026-10-20-beta",
      profile: "OWN_CLIENT",
      status: "CONNECTED",
      storageProtection: "OS_BACKED",
    });
    expect(revealCredentials(result.credentials)).toEqual({
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      profile: "OWN_CLIENT",
    });
  });

  test("saves an authorized session and clears its pending transaction", async () => {
    const expiresAt = DateTime.makeUnsafe("2026-10-24T14:00:00Z");
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe("2026-10-24T12:00:00Z");

      yield* transactionDAO.replace({
        clientId: CLIENT_ID,
        createdAt,
        expectedGeneration: null,
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "OWN_CLIENT_USER",
        protectedVerifier: encodeProtectedValue({
          protection: "OS_BACKED",
          value: "verifier",
          version: 1,
        }),
        redirectUri: REDIRECT_URI,
        state: OAUTH_STATE,
      });

      yield* connection.saveAuthorizedSession({
        accessToken: Redacted.make("access-token"),
        accessTokenExpiresAt: expiresAt,
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        connectedUserName: CONNECTED_USER_NAME,
        expectedGeneration: null,
        profile: "OWN_CLIENT_USER",
        refreshToken: Redacted.make("refresh-token"),
      });

      return {
        credentials: Option.getOrThrow(yield* connection.getCredentials()),
        pendingAuthorization: yield* transactionDAO.get(),
        summary: Option.getOrThrow(yield* connection.getSummary()),
      };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.summary).toMatchObject({
      connectedUserId: CONNECTED_USER_ID,
      connectedUserName: CONNECTED_USER_NAME,
      profile: "OWN_CLIENT_USER",
      storageProtection: "OS_BACKED",
    });
    expect(revealCredentials(result.credentials)).toEqual({
      clientId: CLIENT_ID,
      connectedUserId: CONNECTED_USER_ID,
      pointSystemOptInRequired: false,
      profile: "OWN_CLIENT_USER",
      tokens: {
        accessToken: "access-token",
        accessTokenExpiresAt: expiresAt,
        refreshToken: "refresh-token",
      },
    });
    expect(Option.isNone(result.pendingAuthorization)).toBe(true);
  });

  test("disconnects the active connection and pending authorization", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe("2026-10-24T12:00:00Z");

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });
      yield* transactionDAO.replace({
        clientId: CLIENT_ID,
        createdAt,
        expectedGeneration: null,
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: encodeProtectedValue({
          protection: "OS_BACKED",
          value: "verifier",
          version: 1,
        }),
        redirectUri: REDIRECT_URI,
        state: OAUTH_STATE,
      });

      yield* connection.disconnect();

      return {
        connection: yield* connection.getSummary(),
        pendingAuthorization: yield* transactionDAO.get(),
      };
    }).pipe(E.provide(TestLayer), runTest);

    expect(Option.isNone(result.connection)).toBe(true);
    expect(Option.isNone(result.pendingAuthorization)).toBe(true);
  });

  test("records the point-system opt-in for the connected recommended-profile user", async () => {
    const saveSession = (
      expectedGeneration: FellowshipLogsConnectionGeneration | null,
    ) =>
      FellowshipLogsConnection.use((connection) => {
        return connection.saveAuthorizedSession({
          accessToken: Redacted.make("access-token"),
          accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          connectedUserId: CONNECTED_USER_ID,
          connectedUserName: CONNECTED_USER_NAME,
          expectedGeneration,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          refreshToken: Redacted.make("refresh-token"),
        });
      });

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const getStatus = connection
        .getSummary()
        .pipe(E.map((summary) => Option.getOrThrow(summary).status));

      yield* saveSession(null);
      const required = yield* connection.setPointSystemOptInRequired({
        connectedUserId: CONNECTED_USER_ID,
        required: true,
      });
      const requiredStatus = yield* getStatus;
      const requiredCredentials = Option.getOrThrow(
        yield* connection.getCredentials(),
      );

      const otherUser = yield* connection.setPointSystemOptInRequired({
        connectedUserId: OTHER_USER_ID,
        required: false,
      });
      const afterOtherUserStatus = yield* getStatus;

      yield* connection.setPointSystemOptInRequired({
        connectedUserId: CONNECTED_USER_ID,
        required: false,
      });
      const optedInStatus = yield* getStatus;

      yield* connection.setPointSystemOptInRequired({
        connectedUserId: CONNECTED_USER_ID,
        required: true,
      });
      yield* saveSession(
        Option.getOrThrow(yield* connection.getSummary()).generation,
      );
      const reauthorizedStatus = yield* getStatus;

      return {
        afterOtherUserStatus,
        optedInStatus,
        otherUser,
        reauthorizedStatus,
        required,
        requiredCredentials,
        requiredStatus,
      };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.required).toBe("UPDATED");
    expect(result.requiredStatus).toBe("POINT_SYSTEM_OPT_IN_REQUIRED");
    expect(result.requiredCredentials).toMatchObject({
      pointSystemOptInRequired: true,
    });
    expect(result.otherUser).toBe("SESSION_CHANGED");
    expect(result.afterOtherUserStatus).toBe("POINT_SYSTEM_OPT_IN_REQUIRED");
    expect(result.optedInStatus).toBe("CONNECTED");
    expect(result.reauthorizedStatus).toBe("CONNECTED");
  });

  test("keeps the connection generation across token, reauthorization, and opt-in updates", async () => {
    const generations = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const getGeneration = connection
        .getSummary()
        .pipe(E.map((summary) => Option.getOrThrow(summary).generation));

      yield* connection.saveAuthorizedSession({
        accessToken: Redacted.make("access-token"),
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        connectedUserName: CONNECTED_USER_NAME,
        expectedGeneration: null,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        refreshToken: Redacted.make("refresh-token"),
      });
      const saved = yield* getGeneration;

      yield* connection.replaceTokens({
        accessToken: Redacted.make("rotated-access-token"),
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T15:00:00Z"),
        expectedAccessToken: Redacted.make("access-token"),
        refreshToken: Redacted.make("rotated-refresh-token"),
      });
      const afterRotation = yield* getGeneration;

      yield* connection.setPointSystemOptInRequired({
        connectedUserId: CONNECTED_USER_ID,
        required: true,
      });
      const afterOptIn = yield* getGeneration;

      yield* connection.requireReauthorization({
        expectedAccessToken: Redacted.make("rotated-access-token"),
      });
      const afterReauthorization = yield* getGeneration;

      return { afterOptIn, afterReauthorization, afterRotation, saved };
    }).pipe(E.provide(TestLayer), runTest);

    expect(generations).toEqual({
      afterOptIn: generations.saved,
      afterReauthorization: generations.saved,
      afterRotation: generations.saved,
      saved: generations.saved,
    });
  });

  test("installs a new generation whenever a connection is saved, even for the same target", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const saveOwnClient = (
        expectedGeneration: FellowshipLogsConnectionGeneration | null,
      ) =>
        connection
          .saveOwnClient({
            allowLocalFallback: false,
            clientId: CLIENT_ID,
            clientSecret: Redacted.make("client-secret"),
            expectedGeneration,
          })
          .pipe(
            E.andThen(connection.getSummary()),
            E.map((summary) => Option.getOrThrow(summary).generation),
          );

      const first = yield* saveOwnClient(null);
      const second = yield* saveOwnClient(first);

      return { first, second };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.second).not.toBe(result.first);
  });

  test("rejects a save whose expected generation is stale and keeps the newer connection", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const getSummary = connection.getSummary().pipe(E.map(Option.getOrThrow));

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });
      const observed = (yield* getSummary).generation;

      yield* connection.saveAuthorizedSession({
        accessToken: Redacted.make("access-token"),
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        connectedUserName: CONNECTED_USER_NAME,
        expectedGeneration: observed,
        profile: "OWN_CLIENT_USER",
        refreshToken: Redacted.make("refresh-token"),
      });
      const newer = yield* getSummary;

      const staleClientSave = yield* connection
        .saveOwnClient({
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          clientSecret: Redacted.make("stale-client-secret"),
          expectedGeneration: observed,
        })
        .pipe(E.flip);
      const staleAbsentSave = yield* connection
        .saveAuthorizedSession({
          accessToken: Redacted.make("stale-access-token"),
          accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          connectedUserId: OTHER_USER_ID,
          connectedUserName: CONNECTED_USER_NAME,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          refreshToken: null,
        })
        .pipe(E.flip);

      return {
        afterStaleSaves: yield* getSummary,
        credentials: Option.getOrThrow(yield* connection.getCredentials()),
        newer,
        staleAbsentSave,
        staleClientSave,
      };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.staleClientSave._tag).toBe(
      "FellowshipLogsConnectionChangedError",
    );
    expect(result.staleAbsentSave._tag).toBe(
      "FellowshipLogsConnectionChangedError",
    );
    expect(result.afterStaleSaves).toEqual(result.newer);
    expect(revealCredentials(result.credentials)).toMatchObject({
      tokens: { accessToken: "access-token" },
    });
  });

  test("rejects a save that expected a connection after it was disconnected", async () => {
    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* connection.saveOwnClient({
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("client-secret"),
        expectedGeneration: null,
      });
      const observed = Option.getOrThrow(
        yield* connection.getSummary(),
      ).generation;

      yield* connection.disconnect();

      const staleSave = yield* connection
        .saveOwnClient({
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          clientSecret: Redacted.make("client-secret"),
          expectedGeneration: observed,
        })
        .pipe(E.flip);

      return { connection: yield* connection.getSummary(), staleSave };
    }).pipe(E.provide(TestLayer), runTest);

    expect(result.staleSave._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(Option.isNone(result.connection)).toBe(true);
  });

  test("never records a point-system opt-in for another profile", async () => {
    const update = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* connection.saveAuthorizedSession({
        accessToken: Redacted.make("access-token"),
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        connectedUserId: CONNECTED_USER_ID,
        connectedUserName: CONNECTED_USER_NAME,
        expectedGeneration: null,
        profile: "OWN_CLIENT_USER",
        refreshToken: Redacted.make("refresh-token"),
      });

      return yield* connection.setPointSystemOptInRequired({
        connectedUserId: CONNECTED_USER_ID,
        required: true,
      });
    }).pipe(E.provide(TestLayer), runTest);

    expect(update).toBe("SESSION_CHANGED");
  });
});
