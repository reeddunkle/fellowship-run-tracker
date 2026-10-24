import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { FellowshipLogsAuthorization } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { makeLocalProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { makeRecordingTracer } from "@frt/api/tests/common/make-recording-tracer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";

import {
  ACCESS_TOKEN,
  AUTHORIZATION_CODE,
  LocalEncryption,
  makeCallbackUrl,
  makeOAuthClient,
  makeTestLayer,
  OsBackedProtectedValueStorage,
  OWN_CLIENT_ID,
  REFRESH_TOKEN,
  readStoredState,
  sendBrowserCallback,
  startAuthorization,
  waitForStatus,
  waitUntilClosed,
} from "./fellowship-logs-authorization-test-helpers.ts";

describe("FellowshipLogsAuthorization security", () => {
  test("requires acknowledgement before protecting the verifier with a local key", async () => {
    const result = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

      const refused = yield* authorization
        .start({
          allowLocalFallback: false,
          expectedGeneration: null,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
        })
        .pipe(E.flip);
      const afterRefusal = {
        status: yield* authorization.getStatus(),
        transaction: yield* transactionDAO.get(),
      };

      const started = yield* authorization.start({
        allowLocalFallback: true,
        expectedGeneration: null,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      });

      return { afterRefusal, refused, started };
    }).pipe(
      E.provide(
        makeTestLayer({
          protectedValueStorage:
            makeLocalProtectedValueStorage(LocalEncryption),
        }),
      ),
      runTest,
    );

    expect(result.refused._tag).toBe(
      "LocalProtectionAcknowledgementRequiredError",
    );
    expect(result.afterRefusal.status._tag).toBe("Idle");
    expect(Option.isNone(result.afterRefusal.transaction)).toBe(true);
    expect(result.started.storageProtection).toBe("LOCAL_KEY");
  });

  test("ignores a callback for another state and keeps listening", async () => {
    const { client, exchangeCodeCalls } = makeOAuthClient();

    const status = await E.gen(function* () {
      const { transaction } = yield* startAuthorization;

      yield* sendBrowserCallback(
        makeCallbackUrl(transaction, {
          code: "forged-code",
          state: "another-state",
        }),
      );
      yield* sendBrowserCallback(
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      );

      return yield* waitForStatus("Connected");
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(status._tag).toBe("Connected");
    expect(exchangeCodeCalls.map((call) => call.code)).toEqual([
      AUTHORIZATION_CODE,
    ]);
  });

  test("reports a provider rejection and closes the listener", async () => {
    const { client } = makeOAuthClient({
      exchangeCode: () =>
        E.fail(
          new FellowshipLogsOAuthProviderError({
            operation: "ExchangeCode",
            providerError: "invalid_grant",
            reason: "Rejected",
            status: 400,
          }),
        ),
    });

    const result = await E.gen(function* () {
      const { transaction } = yield* startAuthorization;

      yield* sendBrowserCallback(
        makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      );

      return {
        closed: yield* waitUntilClosed(transaction.redirectUri),
        status: yield* waitForStatus("Failed"),
        stored: yield* readStoredState,
      };
    }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

    expect(result.status).toEqual({
      _tag: "Failed",
      failure: "ProviderRejected",
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
    });
    expect(Option.isNone(result.stored.transaction)).toBe(true);
    expect(Option.isNone(result.stored.summary)).toBe(true);
    expect(result.closed).toBe(true);
  });

  test.each([
    ["rejected exchange", "ExchangeCode", "Rejected", "OwnClientRejected"],
    [
      "unavailable exchange",
      "ExchangeCode",
      "Unavailable",
      "ProviderUnavailable",
    ],
    ["rejected user lookup", "GetCurrentUser", "Rejected", "ProviderRejected"],
  ] as const)(
    "classifies an own-client %s",
    async (_name, operation, reason, failure) => {
      const providerError = new FellowshipLogsOAuthProviderError({
        operation,
        providerError: null,
        reason,
        status: reason === "Rejected" ? 400 : 503,
      });
      const { client } = makeOAuthClient(
        operation === "ExchangeCode"
          ? { exchangeCode: () => E.fail(providerError) }
          : { getCurrentUser: () => E.fail(providerError) },
      );

      const status = await E.gen(function* () {
        const authorization = yield* FellowshipLogsAuthorization;
        const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

        yield* authorization.start({
          allowLocalFallback: false,
          clientId: OWN_CLIENT_ID,
          expectedGeneration: null,
          profile: "OWN_CLIENT_USER",
        });
        const transaction = Option.getOrThrow(yield* transactionDAO.get());

        yield* sendBrowserCallback(
          makeCallbackUrl(transaction, {
            code: AUTHORIZATION_CODE,
            state: transaction.state,
          }),
        );

        return yield* waitForStatus("Failed");
      }).pipe(E.provide(makeTestLayer({ oauthClient: client })), runTest);

      expect(status).toEqual({
        _tag: "Failed",
        failure,
        profile: "OWN_CLIENT_USER",
      });
    },
  );

  test("saves the session with local-key protection when the verifier used it", async () => {
    const summary = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

      yield* authorization.start({
        allowLocalFallback: true,
        expectedGeneration: null,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      });
      const transaction = Option.getOrThrow(yield* transactionDAO.get());

      yield* authorization.complete({
        callbackUrl: makeCallbackUrl(transaction, {
          code: AUTHORIZATION_CODE,
          state: transaction.state,
        }),
      });

      return Option.getOrThrow((yield* readStoredState).summary);
    }).pipe(
      E.provide(
        makeTestLayer({
          protectedValueStorage:
            makeLocalProtectedValueStorage(LocalEncryption),
        }),
      ),
      runTest,
    );

    expect(summary.storageProtection).toBe("LOCAL_KEY");
  });

  test("keeps the code, verifier, tokens, and callback URL out of spans", async () => {
    const { spans, tracer } = makeRecordingTracer();

    const secrets = await E.gen(function* () {
      const authorization = yield* FellowshipLogsAuthorization;
      const { transaction } = yield* startAuthorization;
      const storedVerifier = yield* OsBackedProtectedValueStorage.unprotect(
        transaction.protectedVerifier,
      );
      const callbackUrl = makeCallbackUrl(transaction, {
        code: AUTHORIZATION_CODE,
        state: transaction.state,
      });

      yield* authorization.complete({ callbackUrl }).pipe(E.withTracer(tracer));

      return [
        AUTHORIZATION_CODE,
        Redacted.value(storedVerifier),
        ACCESS_TOKEN,
        REFRESH_TOKEN,
        transaction.state,
      ];
    }).pipe(E.provide(makeTestLayer()), runTest);

    const recorded = JSON.stringify(
      spans.map((span) => ({
        attributes: Object.fromEntries(span.attributes),
        events: span.events,
        name: span.name,
      })),
      (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
    );

    expect(
      spans.some(
        (span) => span.name === "FellowshipLogsAuthorization.complete",
      ),
    ).toBe(true);

    for (const secret of secrets) {
      expect(recorded).not.toContain(secret);
    }
  });
});
