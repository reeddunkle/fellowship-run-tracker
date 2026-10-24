import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { type FellowshipLogsAuthorizationTransactionModel } from "@frt/db/models/fellowship-logs-authorization-transaction-model.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import {
  ACCESS_TOKEN,
  ACCESS_TOKEN_LIFETIME_SECONDS,
  AUTHORIZATION_CODE,
  CONNECTED_USER,
  DEFAULT_CONFIG,
  FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
  isListening,
  makeCallbackUrl,
  makeOAuthClient,
  makePointSystemOptIn,
  makeSystemBrowser,
  makeTestLayer,
  OsBackedProtectedValueStorage,
  REFRESH_TOKEN,
  readStoredState,
  revealCredentials,
  startAuthorization,
  waitUntilClosed,
} from "./fellowship-logs-authorization-test-helpers.ts";

describe("FellowshipLogsAuthorization completion and recovery", () => {
  test("completes a pasted approval, saves the session, and ends the listener", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;

      const completed = yield* authorization.complete({
        callbackUrl: makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      });

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        completed,
        status: yield* authorization.getStatus(),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.completed).toEqual({
      _tag: "Connected",
      connectedUserName: CONNECTED_USER.name,
      pointSystemOptIn: "OPTED_IN",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(result.status).toEqual(result.completed);
    expect(exchangeCodeCalls).toHaveLength(1);
    expect(Option.getOrThrow(result.stored.summary)).toMatchObject({
      clientId: FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
      connectedUserId: CONNECTED_USER.id,
      connectedUserName: CONNECTED_USER.name,
      storageProtection: "OS_BACKED",
    });
    expect(
      revealCredentials(Option.getOrThrow(result.stored.credentials)),
    ).toEqual({
      accessToken: ACCESS_TOKEN,
      accessTokenExpiresAt: DateTime.add(DateTime.makeUnsafe(0), {
        seconds: ACCESS_TOKEN_LIFETIME_SECONDS,
      }),
      refreshToken: REFRESH_TOKEN,
    });
    expect(Option.isNone(result.stored.transaction)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test("reports a missing point-system opt-in found after connecting", async () => {
    const { checks, service } = makePointSystemOptIn(() =>
      E.succeed("OPT_IN_REQUIRED"),
    );

    const completed = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;

      return yield* authorization.complete({
        callbackUrl: makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      });
    }).pipe(E.provide(makeTestLayer({ pointSystemOptIn: service })), runTest);

    expect(checks.count).toBe(1);
    expect(completed).toMatchObject({
      _tag: "Connected",
      pointSystemOptIn: "OPT_IN_REQUIRED",
    });
  });

  test("stays connected and reports an unchecked opt-in when the check fails", async () => {
    const { service } = makePointSystemOptIn(() =>
      E.fail(
        new FellowshipLogsGatewayRequestError({
          cause: null,
          operation: "Query",
        }),
      ),
    );

    const completed = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;

      return yield* authorization.complete({
        callbackUrl: makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      });
    }).pipe(E.provide(makeTestLayer({ pointSystemOptIn: service })), runTest);

    expect(completed).toMatchObject({
      _tag: "Connected",
      pointSystemOptIn: "UNCHECKED",
    });
  });

  test("returns a denial for a pasted denial", async () => {
    const completed = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;

      return yield* authorization.complete({
        callbackUrl: makeCallbackUrl(transaction, {
          error: "access_denied",
          state: transaction.state,
        }),
      });
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(completed).toEqual({
      _tag: "Denied",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
  });

  test.each([
    [
      "a mismatched state",
      "StateMismatch",
      (transaction: FellowshipLogsAuthorizationTransactionModel) =>
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: "another-state",
        }),
    ],
    [
      "a different callback path",
      "InvalidCallback",
      (transaction: FellowshipLogsAuthorizationTransactionModel) =>
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }).replace("/oauth/callback", "/oauth/other"),
    ],
    [
      "an unexpected parameter",
      "InvalidCallback",
      (transaction: FellowshipLogsAuthorizationTransactionModel) =>
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          scope: "everything",
          state: transaction.state,
        }),
    ],
  ])(
    "rejects %s and keeps the authorization pending",
    async (_name, reason, makeUrl) => {
      const { client, exchangeCodeCalls } = makeOAuthClient();

      const result = await E.gen(function* () {
        const authorization = yield* FellowshipLogsAuthorization;
        const { transaction } = yield* startAuthorization;

        const error = yield* authorization
          .complete({ callbackUrl: makeUrl(transaction) })
          .pipe(E.flip);

        return {
          error,
          listening: yield* isListening(transaction.redirectUri),
          status: yield* authorization.getStatus(),
          stored: yield* readStoredState,
        };
      }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

      expect(result.error).toMatchObject({
        _tag: "FellowshipLogsAuthorizationCallbackError",
        reason,
      });
      expect(exchangeCodeCalls).toHaveLength(0);
      expect(result.status._tag).toBe("Pending");
      expect(result.listening).toBe(true);
      expect(Option.isSome(result.stored.transaction)).toBe(true);
    },
  );

  test("rejects a callback without a pending authorization", async () => {
    const error = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;

      return yield* authorization
        .complete({
          callbackUrl: `http://127.0.0.1:51234/oauth/callback?code=${AUTHORIZATION_CODE}&state=state`,
        })
        .pipe(E.flip);
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(error).toMatchObject({ reason: "NoPendingAuthorization" });
  });

  test("deletes an authorization that expired while the app was closed when it starts", async () => {
    const redirectUri = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
      "http://127.0.0.1:51234/oauth/callback",
    );
    const clientId = Schema.decodeSync(FellowshipLogsClientIdSchema)(
      FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
    );
    const state = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");

    const storedTransaction = await E.gen(function* () {
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe(0);

      yield* transactionDAO.replace({
        clientId,
        createdAt,
        expectedGeneration: null,
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: yield* OsBackedProtectedValueStorage.protect(
          Redacted.make("verifier"),
          { allowLocalFallback: false },
        ),
        redirectUri,
        state,
      });
      yield* TestClock.adjust("10 minutes");

      yield* Layer.build(
        Layer.fresh(FellowshipLogsAuthorization.layerNoDeps).pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(
                ProtectedValueStorage,
                OsBackedProtectedValueStorage,
              ),
              Layer.succeed(
                FellowshipLogsOAuthClient,
                makeOAuthClient().client,
              ),
              Layer.succeed(
                FellowshipLogsPointSystemOptIn,
                makePointSystemOptIn().service,
              ),
              Layer.succeed(SystemBrowser, makeSystemBrowser().browser),
              ConfigProvider.layer(ConfigProvider.fromUnknown(DEFAULT_CONFIG)),
            ),
          ),
        ),
      );

      return yield* transactionDAO.get();
    }).pipe(E.scoped, E.provide(makeTestLayer()), runTest);

    expect(Option.isNone(storedTransaction)).toBe(true);
  });

  test("rejects and discards a stored transaction that has expired", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();
    const redirectUri = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
      "http://127.0.0.1:51234/oauth/callback",
    );
    const clientId = Schema.decodeSync(FellowshipLogsClientIdSchema)(
      FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
    );
    const state = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe(0);

      yield* transactionDAO.replace({
        clientId,
        createdAt,
        expectedGeneration: null,
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: yield* OsBackedProtectedValueStorage.protect(
          Redacted.make("verifier"),
          { allowLocalFallback: false },
        ),
        redirectUri,
        state,
      });
      yield* TestClock.adjust("10 minutes");

      const error = yield* authorization
        .complete({
          callbackUrl: `${redirectUri}?code=${AUTHORIZATION_CODE}&state=state`,
        })
        .pipe(E.flip);

      return { error, stored: yield* readStoredState };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.error).toMatchObject({ reason: "Expired" });
    expect(exchangeCodeCalls).toHaveLength(0);
    expect(Option.isNone(result.stored.transaction)).toBe(true);
  });

  test("exchanges a pasted approval after a restart, with no active session", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();
    const redirectUri = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
      "http://127.0.0.1:51234/oauth/callback",
    );
    const clientId = Schema.decodeSync(FellowshipLogsClientIdSchema)(
      FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
    );
    const state = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe(0);

      yield* transactionDAO.replace({
        clientId,
        createdAt,
        expectedGeneration: null,
        expiresAt: DateTime.add(createdAt, { minutes: 10 }),
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: yield* OsBackedProtectedValueStorage.protect(
          Redacted.make("verifier"),
          { allowLocalFallback: false },
        ),
        redirectUri,
        state,
      });

      const completed = yield* authorization.complete({
        callbackUrl: `${redirectUri}?code=${AUTHORIZATION_CODE}&state=state`,
      });

      return { completed, stored: yield* readStoredState };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.completed._tag).toBe("Connected");
    expect(exchangeCodeCalls).toHaveLength(1);
    expect(Option.isSome(result.stored.summary)).toBe(true);
  });
});
