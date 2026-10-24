import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as TestClock from "effect/testing/TestClock";
import { describe, expect, test } from "vitest";

import { SystemBrowserError } from "@frt/api/errors/system-browser-error.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { deriveCodeChallenge } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-pkce.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";

import {
  AUTHORIZATION_CODE,
  AUTHORIZATION_ENDPOINT,
  CONNECTED_USER,
  FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
  isListening,
  LOOPBACK_REDIRECT_URI_PATTERN,
  makeCallbackUrl,
  makeOAuthClient,
  makeSystemBrowser,
  makeTestLayer,
  OsBackedProtectedValueStorage,
  OWN_CLIENT_ID,
  readStoredState,
  revealAuthorizationUrl,
  sendBrowserCallback,
  startAuthorization,
  waitForStatus,
  waitUntilClosed,
} from "./fellowship-logs-authorization-test-helpers.ts";

describe("FellowshipLogsAuthorization lifecycle", () => {
  test("listens on a loopback port, stores the transaction, and opens the browser", async () => {
    const { browser, openedUrls } = makeSystemBrowser();

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { started, transaction } = yield* startAuthorization;
      const verifier = yield* OsBackedProtectedValueStorage.unprotect(
        transaction.protectedVerifier,
      );

      return {
        expectedChallenge: Redacted.value(yield* deriveCodeChallenge(verifier)),
        listening: yield* isListening(transaction.redirectUri),
        started,
        status: yield* authorization.getStatus(),
        transaction,
        verifier: Redacted.value(verifier),
      };
    }).pipe(E.provide(makeTestLayer({ systemBrowser: browser })), runTest);

    const url = revealAuthorizationUrl(result.started.authorizationUrl);

    expect(result.transaction.redirectUri).toMatch(
      LOOPBACK_REDIRECT_URI_PATTERN,
    );
    expect(result.listening).toBe(true);
    expect(url.origin + url.pathname).toBe(AUTHORIZATION_ENDPOINT);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
      code_challenge: result.expectedChallenge,
      code_challenge_method: "S256",
      redirect_uri: result.transaction.redirectUri,
      response_type: "code",
      state: result.transaction.state,
    });
    expect(openedUrls).toEqual([url.toString()]);
    expect(result.started).toMatchObject({
      browserLaunch: "Opened",
      expiresAt: result.transaction.expiresAt,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
      storageProtection: "OS_BACKED",
    });
    expect(result.status).toEqual({
      _tag: "Pending",
      expiresAt: result.transaction.expiresAt,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(
      Duration.toMillis(
        DateTime.distance(
          result.transaction.createdAt,
          result.transaction.expiresAt,
        ),
      ),
    ).toBe(Duration.toMillis("10 minutes"));
    expect(String(result.started.authorizationUrl)).not.toContain(
      result.transaction.state,
    );
    expect(JSON.stringify(result.transaction)).not.toContain(result.verifier);
    expect(JSON.stringify(result.transaction)).not.toContain(
      result.expectedChallenge,
    );
  });

  test("uses the supplied client ID for an own-client authorization", async () => {
    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;

      const started = yield* authorization.start({
        allowLocalFallback: false,
        clientId: OWN_CLIENT_ID,
        expectedGeneration: null,
        profile: "OWN_CLIENT_USER",
      });

      return {
        pending: Option.getOrThrow(
          yield* (yield* FellowshipLogsAuthorizationTransactionDAO).get(),
        ),
        started,
      };
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(
      revealAuthorizationUrl(result.started.authorizationUrl).searchParams.get(
        "client_id",
      ),
    ).toBe(OWN_CLIENT_ID);
    expect(result.pending).toMatchObject({
      clientId: OWN_CLIENT_ID,
      expiresAt: result.started.expiresAt,
      profile: "OWN_CLIENT_USER",
    });
  });

  test("keeps the authorization pending when the browser cannot open", async () => {
    const { browser } = makeSystemBrowser(() =>
      E.fail(new SystemBrowserError({ reason: "LaunchFailed" })),
    );

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { started, transaction } = yield* startAuthorization;

      return {
        listening: yield* isListening(transaction.redirectUri),
        started,
        status: yield* authorization.getStatus(),
      };
    }).pipe(E.provide(makeTestLayer({ systemBrowser: browser })), runTest);

    expect(result.started.browserLaunch).toBe("LaunchFailed");
    expect(result.status._tag).toBe("Pending");
    expect(result.listening).toBe(true);
  });

  test("replaces the previous authorization and closes its listener", async () => {
    const result = await E.gen(function* () {
      const first = yield* startAuthorization;
      const second = yield* startAuthorization;

      return {
        first: first.transaction,
        firstClosed: yield* waitUntilClosed(first.transaction.redirectUri),
        second: second.transaction,
        secondListening: yield* isListening(second.transaction.redirectUri),
      };
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(result.second.state).not.toBe(result.first.state);
    expect(result.second.protectedVerifier).not.toBe(
      result.first.protectedVerifier,
    );
    expect(result.firstClosed).toBe(true);
    expect(result.secondListening).toBe(true);
  });

  test("expires the authorization, deletes the transaction, and closes the listener", async () => {
    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const { transaction } = yield* startAuthorization;

      yield* TestClock.adjust("9 minutes");
      const beforeExpiry = yield* authorization.getStatus();

      yield* TestClock.adjust("1 minute");
      const status = yield* waitForStatus("Expired");

      return {
        beforeExpiry,
        closed: yield* waitUntilClosed(transaction.redirectUri),
        status,
        storedTransaction: yield* transactionDAO.get(),
      };
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(result.beforeExpiry._tag).toBe("Pending");
    expect(result.status).toEqual({
      _tag: "Expired",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(Option.isNone(result.storedTransaction)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test("cancels the authorization, deletes the transaction, and closes the listener", async () => {
    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const { transaction } = yield* startAuthorization;

      yield* authorization.cancel();

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        status: yield* authorization.getStatus(),
        storedTransaction: yield* transactionDAO.get(),
      };
    }).pipe(E.provide(makeTestLayer()), runTest);

    expect(result.status).toEqual({
      _tag: "Cancelled",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(Option.isNone(result.storedTransaction)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test("returns to idle, deletes the transaction, and closes the listener when start is interrupted", async () => {
    const { browser } = makeSystemBrowser(() => E.never);

    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

      const starting = yield* startAuthorization.pipe(E.forkChild);

      yield* waitForStatus("Pending");
      const transaction = Option.getOrThrow(yield* transactionDAO.get());

      yield* Fiber.interrupt(starting);

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        status: yield* authorization.getStatus(),
        storedTransaction: yield* transactionDAO.get(),
      };
    }).pipe(E.provide(makeTestLayer({ systemBrowser: browser })), runTest);

    expect(result.status).toEqual({ _tag: "Idle" });
    expect(Option.isNone(result.storedTransaction)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test("refuses to start without a configured client ID", async () => {
    const error = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;

      return yield* authorization
        .start({
          allowLocalFallback: false,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
        })
        .pipe(E.flip);
    }).pipe(
      E.provide(
        makeTestLayer({
          config: {},
        }),
      ),
      runTest,
    );

    expect(error).toMatchObject({
      _tag: "FellowshipLogsAuthorizationNotConfiguredError",
      setting: "ClientId",
    });
  });

  test("completes an approval from the browser and closes the listener", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();

    const result = await E.gen(function* () {
      const { transaction } = yield* startAuthorization;
      const verifier = yield* OsBackedProtectedValueStorage.unprotect(
        transaction.protectedVerifier,
      );

      const responseStatus = yield* sendBrowserCallback(
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      );
      const status = yield* waitForStatus("Connected");

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        responseStatus,
        status,
        stored: yield* readStoredState,
        transaction,
        verifier: Redacted.value(verifier),
      };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.responseStatus).toBe(200);
    expect(result.status).toEqual({
      _tag: "Connected",
      connectedUserName: CONNECTED_USER.name,
      pointSystemOptIn: "OPTED_IN",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(exchangeCodeCalls).toEqual([
      {
        clientId: FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
        code: AUTHORIZATION_CODE,
        codeVerifier: result.verifier,
        redirectUri: result.transaction.redirectUri,
      },
    ]);
    expect(Option.getOrThrow(result.stored.summary)).toMatchObject({
      connectedUserId: CONNECTED_USER.id,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(Option.isNone(result.stored.transaction)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test("reports a denial from the browser", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();

    const result = await E.gen(function* () {
      const { transaction } = yield* startAuthorization;

      yield* sendBrowserCallback(
        makeCallbackUrl(transaction, {
          error: "access_denied",
          error_description:
            "The resource owner or authorization server denied the request.",
          hint: "",
          state: transaction.state,
        }),
      );

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        status: yield* waitForStatus("Denied"),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.status).toEqual({
      _tag: "Denied",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(exchangeCodeCalls).toHaveLength(0);
    expect(Option.isNone(result.stored.summary)).toBe(true);
    expect(result.closed).toBe(true);
  });
});
