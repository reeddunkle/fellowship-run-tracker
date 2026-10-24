import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { type FellowshipLogsOAuthClientShape } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { type ProtectedValueStorageShape } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { type FellowshipLogsAuthorizationTransactionModel } from "@frt/db/models/fellowship-logs-authorization-transaction-model.ts";
import {
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import {
  AUTHORIZATION_CODE,
  CONNECTED_USER,
  getGeneration,
  isListening,
  makeCallbackUrl,
  makeOAuthClient,
  makePointSystemOptIn,
  makeSystemBrowser,
  makeTestLayer,
  OsBackedProtectedValueStorage,
  OWN_CLIENT_ID,
  RECOMMENDED_CLIENT_ID,
  readStoredState,
  revealCredentials,
  sendBrowserCallback,
  startAuthorization,
  waitForStatus,
  waitUntilClosed,
} from "./fellowship-logs-authorization-test-helpers.ts";

describe("FellowshipLogsAuthorization concurrency", () => {
  const authorizeElsewhere = (
    connection: FellowshipLogsConnectionShape,
    accessToken: string,
  ) =>
    getGeneration(connection).pipe(
      E.flatMap((expectedGeneration) => {
        return connection.saveAuthorizedSession({
          accessToken: Redacted.make(accessToken),
          accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T14:00:00Z"),
          allowLocalFallback: false,
          clientId: RECOMMENDED_CLIENT_ID,
          connectedUserId: CONNECTED_USER.id,
          connectedUserName: CONNECTED_USER.name,
          expectedGeneration,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          refreshToken: null,
        });
      }),
    );

  function makeTestLayerChangingDuringExchange(
    changeConnection: (
      connection: FellowshipLogsConnectionShape,
    ) => E.Effect<void, unknown>,
  ) {
    const changes: { connection: FellowshipLogsConnectionShape | null } = {
      connection: null,
    };
    const { client, exchangeCodeCalls } = makeOAuthClient();
    const exchangeCode = client.exchangeCode;
    const oauthClient: FellowshipLogsOAuthClientShape = {
      ...client,
      exchangeCode: (options) => {
        const connection = changes.connection;

        return (
          connection === null ? E.void : changeConnection(connection)
        ).pipe(E.orDie, E.andThen(exchangeCode(options)));
      },
    };

    return {
      exchangeCodeCalls,
      layer: makeTestLayer({ oauthClient }),
      watch: (connection: FellowshipLogsConnectionShape) => {
        changes.connection = connection;
      },
    };
  }

  const completeApproval = E.fnUntraced(function* (
    transaction: FellowshipLogsAuthorizationTransactionModel,
  ) {
    const authorization = yield* FellowshipLogsAuthorization;

    return yield* authorization
      .complete({
        callbackUrl: makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      })
      .pipe(E.flip);
  });

  test("waits for a start in progress before starting another", async () => {
    const firstProtectStarted = Deferred.makeUnsafe<void>();
    const releaseFirstProtect = Deferred.makeUnsafe<void>();
    const protectCalls = { count: 0 };
    const protectedValueStorage: ProtectedValueStorageShape = {
      ...OsBackedProtectedValueStorage,
      protect: (value, options) => {
        protectCalls.count += 1;

        return protectCalls.count === 1
          ? Deferred.succeed(firstProtectStarted, undefined).pipe(
              E.andThen(Deferred.await(releaseFirstProtect)),
              E.andThen(OsBackedProtectedValueStorage.protect(value, options)),
            )
          : OsBackedProtectedValueStorage.protect(value, options);
      },
    };

    const result = await E.gen(function* () {
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

      const first = yield* startAuthorization.pipe(E.forkChild);

      yield* Deferred.await(firstProtectStarted);

      const second = yield* startAuthorization.pipe(E.forkChild);

      yield* E.forEach(A.range(1, 50), () => E.yieldNow, { discard: true });

      const duringFirst = {
        protectCount: protectCalls.count,
        storedTransaction: yield* transactionDAO.get(),
      };

      yield* Deferred.succeed(releaseFirstProtect, undefined);
      const { transaction: firstTransaction } = yield* Fiber.join(first);
      const { transaction: secondTransaction } = yield* Fiber.join(second);

      return {
        duringFirst,
        firstClosed: yield* waitUntilClosed(firstTransaction.redirectUri),
        secondListening: yield* isListening(secondTransaction.redirectUri),
        secondTransaction,
        stored: Option.getOrThrow(yield* transactionDAO.get()),
      };
    }).pipe(E.provide(makeTestLayer({ protectedValueStorage })), runTest);

    expect(result.duringFirst.protectCount).toBe(1);
    expect(Option.isNone(result.duringFirst.storedTransaction)).toBe(true);
    expect(result.stored.state).toBe(result.secondTransaction.state);
    expect(result.firstClosed).toBe(true);
    expect(result.secondListening).toBe(true);
  });

  test("reports a browser that never finishes launching, and lets another start proceed", async () => {
    const { browser, openedUrls } = makeSystemBrowser(() => {
      return openedUrls.length === 1 ? E.never : E.void;
    });

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;

      const first = yield* authorization
        .start({
          allowLocalFallback: false,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
        })
        .pipe(E.forkChild);

      yield* waitForStatus("Pending");

      const second = yield* authorization.start({
        allowLocalFallback: false,
        expectedGeneration: null,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      });

      yield* TestClock.adjust("10 seconds");

      return { first: yield* Fiber.join(first), second };
    }).pipe(E.provide(makeTestLayer({ systemBrowser: browser })), runTest);

    expect(result.first.browserLaunch).toBe("LaunchFailed");
    expect(result.second.browserLaunch).toBe("Opened");
  });

  test("exchanges an authorization code only once", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();

    const replayError = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;
      const callbackUrl = makeCallbackUrl(transaction, {
        code: AUTHORIZATION_CODE,
        state: transaction.state,
      });

      yield* authorization.complete({ callbackUrl });

      return yield* authorization.complete({ callbackUrl }).pipe(E.flip);
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(replayError).toMatchObject({ reason: "NoPendingAuthorization" });
    expect(exchangeCodeCalls).toHaveLength(1);
  });

  test.each([
    { endingStatus: { _tag: "Idle" }, operation: "abandon" },
    {
      endingStatus: {
        _tag: "Cancelled",
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      },
      operation: "cancel",
    },
  ] as const)(
    "saves no session when the authorization is ended by $operation during the code exchange",
    async ({ endingStatus, operation }) => {
      const exchangeStarted = Deferred.makeUnsafe<void>();
      const releaseExchange = Deferred.makeUnsafe<void>();
      const { client } = makeOAuthClient();
      const blockingClient: FellowshipLogsOAuthClientShape = {
        ...client,
        exchangeCode: (options) => {
          return Deferred.succeed(exchangeStarted, undefined).pipe(
            E.andThen(Deferred.await(releaseExchange)),
            E.andThen(client.exchangeCode(options)),
          );
        },
      };

      const result = await E.gen(function* () {
        const authorization = yield* FellowshipLogsAuthorization;
        const { transaction } = yield* startAuthorization;

        const completing = yield* authorization
          .complete({
            callbackUrl: makeCallbackUrl(transaction, {
              code: AUTHORIZATION_CODE,
              state: transaction.state,
            }),
          })
          .pipe(E.flip, E.forkChild);

        yield* Deferred.await(exchangeStarted);
        yield* authorization[operation]();
        yield* Deferred.succeed(releaseExchange, undefined);

        return {
          error: yield* Fiber.join(completing),
          status: yield* authorization.getStatus(),
          stored: yield* readStoredState,
        };
      }).pipe(
        E.provide(makeTestLayer({ oauthClient: blockingClient })),
        runTest,
      );

      expect(result.error).toMatchObject({ reason: "NoPendingAuthorization" });
      expect(result.status).toEqual(endingStatus);
      expect(Option.isNone(result.stored.summary)).toBe(true);
    },
  );

  test("lets the browser's completion finish when the same callback is also pasted", async () => {
    const exchangeStarted = Deferred.makeUnsafe<void>();
    const releaseExchange = Deferred.makeUnsafe<void>();
    const { client } = makeOAuthClient();
    const blockingClient: FellowshipLogsOAuthClientShape = {
      ...client,
      exchangeCode: (options) => {
        return Deferred.succeed(exchangeStarted, undefined).pipe(
          E.andThen(Deferred.await(releaseExchange)),
          E.andThen(client.exchangeCode(options)),
        );
      },
    };

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;
      const callbackUrl = makeCallbackUrl(transaction, {
        code: AUTHORIZATION_CODE,
        state: transaction.state,
      });

      yield* sendBrowserCallback(callbackUrl);
      yield* Deferred.await(exchangeStarted);

      const pastedError = yield* authorization
        .complete({ callbackUrl })
        .pipe(E.flip);
      const statusAfterPaste = yield* authorization.getStatus();

      yield* Deferred.succeed(releaseExchange, undefined);

      return {
        pastedError,
        status: yield* waitForStatus("Connected"),
        statusAfterPaste,
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(makeTestLayer({ oauthClient: blockingClient })), runTest);

    expect(result.pastedError).toMatchObject({
      reason: "NoPendingAuthorization",
    });
    expect(result.statusAfterPaste._tag).toBe("Pending");
    expect(result.status._tag).toBe("Connected");
    expect(Option.isSome(result.stored.summary)).toBe(true);
  });

  test("ignores a cancel that arrives after the session was saved", async () => {
    const checkStarted = Deferred.makeUnsafe<void>();
    const releaseCheck = Deferred.makeUnsafe<void>();
    const { service } = makePointSystemOptIn(() => {
      return Deferred.succeed(checkStarted, undefined).pipe(
        E.andThen(Deferred.await(releaseCheck)),
        E.as("OPTED_IN" as const),
      );
    });

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;

      const completing = yield* authorization
        .complete({
          callbackUrl: makeCallbackUrl(transaction, {
            code: AUTHORIZATION_CODE,
            state: transaction.state,
          }),
        })
        .pipe(E.forkChild);

      yield* Deferred.await(checkStarted);
      yield* authorization.cancel();
      yield* Deferred.succeed(releaseCheck, undefined);

      return {
        completed: yield* Fiber.join(completing),
        status: yield* authorization.getStatus(),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(makeTestLayer({ pointSystemOptIn: service })), runTest);

    expect(result.completed._tag).toBe("Connected");
    expect(result.status._tag).toBe("Connected");
    expect(Option.isSome(result.stored.summary)).toBe(true);
  });

  test("keeps a reauthorization of the same account made while the callback was being completed", async () => {
    const { exchangeCodeCalls, layer, watch } =
      makeTestLayerChangingDuringExchange((connection) => {
        return authorizeElsewhere(connection, "newer-access-token");
      });

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* authorizeElsewhere(connection, "earlier-access-token");

      const { transaction } = yield* startAuthorization;

      watch(connection);

      const error = yield* completeApproval(transaction);

      return {
        error,
        status: yield* waitForStatus("Failed"),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(layer), runTest);

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(result.status).toEqual({
      _tag: "Failed",
      failure: "ConnectionChanged",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(exchangeCodeCalls).toHaveLength(1);
    expect(
      revealCredentials(Option.getOrThrow(result.stored.credentials)),
    ).toMatchObject({ accessToken: "newer-access-token" });
  });

  test("stays disconnected when the confirmed connection is removed while the callback is being completed", async () => {
    const { exchangeCodeCalls, layer, watch } =
      makeTestLayerChangingDuringExchange((connection) => {
        return connection.disconnect();
      });

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;

      yield* authorizeElsewhere(connection, "earlier-access-token");

      const { transaction } = yield* startAuthorization;

      watch(connection);

      return {
        error: yield* completeApproval(transaction),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(layer), runTest);

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(exchangeCodeCalls).toHaveLength(1);
    expect(Option.isNone(result.stored.summary)).toBe(true);
    expect(Option.isNone(result.stored.credentials)).toBe(true);
    expect(Option.isNone(result.stored.transaction)).toBe(true);
  });

  test("keeps a connection installed while completing an authorization that saw none", async () => {
    const { layer, watch } = makeTestLayerChangingDuringExchange(
      (connection) => {
        return connection.saveOwnClient({
          allowLocalFallback: false,
          clientId: OWN_CLIENT_ID,
          clientSecret: Redacted.make("client-secret"),
          expectedGeneration: null,
        });
      },
    );

    const result = await E.gen(function* () {
      const connection = yield* FellowshipLogsConnection;
      const { transaction } = yield* startAuthorization;

      watch(connection);

      return {
        error: yield* completeApproval(transaction),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(layer), runTest);

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(Option.getOrThrow(result.stored.summary)).toMatchObject({
      clientId: OWN_CLIENT_ID,
      profile: "OWN_CLIENT",
    });
  });

  test("checks the stored confirmation when a pasted approval completes after a restart", async () => {
    const redirectUri = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
      "http://127.0.0.1:51234/oauth/callback",
    );
    const state = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");
    const { layer, watch } = makeTestLayerChangingDuringExchange(
      (connection) => {
        return authorizeElsewhere(connection, "newer-access-token");
      },
    );

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const connection = yield* FellowshipLogsConnection;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe(0);

      yield* authorizeElsewhere(connection, "earlier-access-token");
      yield* transactionDAO.replace({
        clientId: RECOMMENDED_CLIENT_ID,
        createdAt,
        expectedGeneration: yield* getGeneration(connection),
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: yield* OsBackedProtectedValueStorage.protect(
          Redacted.make("verifier"),
          { allowLocalFallback: false },
        ),
        redirectUri,
        state,
      });
      watch(connection);

      const error = yield* authorization
        .complete({
          callbackUrl: `${redirectUri}?code=${AUTHORIZATION_CODE}&state=state`,
        })
        .pipe(E.flip);

      return { error, stored: yield* readStoredState };
    }).pipe(E.provide(layer), runTest);

    expect(result.error._tag).toBe("FellowshipLogsConnectionChangedError");
    expect(
      revealCredentials(Option.getOrThrow(result.stored.credentials)),
    ).toMatchObject({ accessToken: "newer-access-token" });
  });
});
