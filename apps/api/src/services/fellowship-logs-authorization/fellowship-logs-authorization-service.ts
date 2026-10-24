import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import type * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as SynchronizedRef from "effect/SynchronizedRef";

import { appConfig } from "@frt/api/app-config.ts";
import {
  FellowshipLogsAuthorizationCallbackError,
  FellowshipLogsAuthorizationError,
  FellowshipLogsAuthorizationNotConfiguredError,
} from "@frt/api/errors/fellowship-logs-authorization-error.ts";
import {
  type FellowshipLogsConnectionChangedError,
  type FellowshipLogsConnectionError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import {
  type LocalProtectionAcknowledgementRequiredError,
  type ProtectedValueStorageError,
} from "@frt/api/errors/protected-value-storage-error.ts";
import { type SystemBrowserError } from "@frt/api/errors/system-browser-error.ts";
import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-pkce.ts";
import { listenForAuthorizationCallback } from "@frt/api/services/fellowship-logs-authorization/listen-for-authorization-callback.ts";
import { parseAuthorizationCallback } from "@frt/api/services/fellowship-logs-authorization/parse-authorization-callback.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import {
  FellowshipLogsPointSystemOptIn,
  type FellowshipLogsPointSystemOptInResult,
} from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsAuthorizedProfile,
  type FellowshipLogsConnectedUserName,
  type FellowshipLogsConnectionGeneration,
  type FellowshipLogsStorageProtection,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const AUTHORIZATION_TRANSACTION_LIFETIME = { minutes: 10 } as const;

const BROWSER_LAUNCH_TIMEOUT = "10 seconds";

type StartAuthorizationTarget =
  | {
      readonly profile: "FELLOWSHIP_RUN_TRACKER_USER";
    }
  | {
      readonly clientId: FellowshipLogsClientId;
      readonly profile: "OWN_CLIENT_USER";
    };

type StartAuthorizationOptions = StartAuthorizationTarget & {
  readonly allowLocalFallback: boolean;
  readonly expectedGeneration: FellowshipLogsConnectionGeneration | null;
};

type BrowserLaunch = "Opened" | SystemBrowserError["reason"];

export type StartedAuthorization = {
  readonly authorizationUrl: Redacted.Redacted<string>;
  readonly browserLaunch: BrowserLaunch;
  readonly expiresAt: DateTime.Utc;
  readonly profile: FellowshipLogsAuthorizedProfile;
  readonly storageProtection: FellowshipLogsStorageProtection;
};

export type StartAuthorizationError =
  | FellowshipLogsAuthorizationError
  | FellowshipLogsAuthorizationNotConfiguredError
  | LocalProtectionAcknowledgementRequiredError;

type FellowshipLogsAuthorizationPointSystemOptIn =
  | FellowshipLogsPointSystemOptInResult
  | "UNCHECKED";

type CompleteAuthorizationOptions = {
  readonly callbackUrl: string;
};

export type CompletedAuthorization =
  | {
      readonly _tag: "Connected";
      readonly connectedUserName: FellowshipLogsConnectedUserName;
      readonly pointSystemOptIn: FellowshipLogsAuthorizationPointSystemOptIn;
      readonly profile: FellowshipLogsAuthorizedProfile;
    }
  | {
      readonly _tag: "Denied";
      readonly profile: FellowshipLogsAuthorizedProfile;
    };

export type CompleteAuthorizationError =
  | FellowshipLogsAuthorizationCallbackError
  | FellowshipLogsAuthorizationError
  | FellowshipLogsConnectionChangedError
  | FellowshipLogsConnectionError
  | FellowshipLogsOAuthProviderError
  | LocalProtectionAcknowledgementRequiredError;

export type FellowshipLogsAuthorizationFailure =
  | "ConnectionChanged"
  | "LocalProtectionAcknowledgementRequired"
  | "OwnClientRejected"
  | "ProviderRejected"
  | "ProviderUnavailable"
  | "ProviderUnexpectedResponse"
  | "Storage";

export type FellowshipLogsAuthorizationStatus =
  | { readonly _tag: "Idle" }
  | {
      readonly _tag: "Pending";
      readonly expiresAt: DateTime.Utc;
      readonly profile: FellowshipLogsAuthorizedProfile;
    }
  | {
      readonly _tag: "Connected";
      readonly connectedUserName: FellowshipLogsConnectedUserName;
      readonly pointSystemOptIn: FellowshipLogsAuthorizationPointSystemOptIn;
      readonly profile: FellowshipLogsAuthorizedProfile;
    }
  | {
      readonly _tag: "Cancelled" | "Denied" | "Expired";
      readonly profile: FellowshipLogsAuthorizedProfile;
    }
  | {
      readonly _tag: "Failed";
      readonly failure: FellowshipLogsAuthorizationFailure;
      readonly profile: FellowshipLogsAuthorizedProfile;
    };

export type FellowshipLogsAuthorizationShape = {
  readonly abandon: () => E.Effect<void>;
  readonly cancel: () => E.Effect<void, FellowshipLogsAuthorizationError>;
  readonly complete: (
    options: CompleteAuthorizationOptions,
  ) => E.Effect<CompletedAuthorization, CompleteAuthorizationError>;
  readonly getStatus: () => E.Effect<FellowshipLogsAuthorizationStatus>;
  readonly start: (
    options: StartAuthorizationOptions,
  ) => E.Effect<StartedAuthorization, StartAuthorizationError>;
  readonly statusChanges: Stream.Stream<FellowshipLogsAuthorizationStatus>;
};

type ActiveSession = {
  readonly isSaved: boolean;
  readonly profile: FellowshipLogsAuthorizedProfile;
  readonly scope: Scope.Closeable;
};

const decodeProtectedValue = Schema.decodeUnknownEffect(ProtectedValueSchema);

const mapAuthorizationError =
  (operation: FellowshipLogsAuthorizationError["operation"]) =>
  (cause: unknown) =>
    new FellowshipLogsAuthorizationError({ cause, operation });

const mapProtectionError = (
  cause:
    | LocalProtectionAcknowledgementRequiredError
    | ProtectedValueStorageError,
) => {
  return cause._tag === "LocalProtectionAcknowledgementRequiredError"
    ? cause
    : new FellowshipLogsAuthorizationError({ cause, operation: "Start" });
};

const PROVIDER_FAILURES = {
  Rejected: "ProviderRejected",
  Unavailable: "ProviderUnavailable",
  UnexpectedResponse: "ProviderUnexpectedResponse",
} as const satisfies Record<
  FellowshipLogsOAuthProviderError["reason"],
  FellowshipLogsAuthorizationFailure
>;

function isRetryableCallbackError(error: CompleteAuthorizationError) {
  return (
    error._tag === "FellowshipLogsAuthorizationCallbackError" &&
    (error.reason === "InvalidCallback" || error.reason === "StateMismatch")
  );
}

function isOwnClientExchangeRejection(
  error: FellowshipLogsOAuthProviderError,
  profile: FellowshipLogsAuthorizedProfile,
) {
  return (
    profile === "OWN_CLIENT_USER" &&
    error.operation === "ExchangeCode" &&
    error.reason === "Rejected"
  );
}

function getFailureStatus(
  error: CompleteAuthorizationError,
  profile: FellowshipLogsAuthorizedProfile,
): FellowshipLogsAuthorizationStatus | null {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      FellowshipLogsAuthorizationCallbackError: (callbackError) =>
        Match.value(callbackError.reason).pipe(
          Match.when("Expired", () => ({ _tag: "Expired", profile }) as const),
          Match.orElse(() => null),
        ),
      FellowshipLogsAuthorizationError: () =>
        ({ _tag: "Failed", failure: "Storage", profile }) as const,
      FellowshipLogsConnectionChangedError: () =>
        ({ _tag: "Failed", failure: "ConnectionChanged", profile }) as const,
      FellowshipLogsConnectionError: () =>
        ({ _tag: "Failed", failure: "Storage", profile }) as const,
      FellowshipLogsOAuthProviderError: (providerError) =>
        ({
          _tag: "Failed",
          failure: isOwnClientExchangeRejection(providerError, profile)
            ? "OwnClientRejected"
            : PROVIDER_FAILURES[providerError.reason],
          profile,
        }) as const,
      LocalProtectionAcknowledgementRequiredError: () =>
        ({
          _tag: "Failed",
          failure: "LocalProtectionAcknowledgementRequired",
          profile,
        }) as const,
    }),
  );
}

const makeFellowshipLogsAuthorization = E.gen(function* () {
  const authorizationTransactionDAO =
    yield* FellowshipLogsAuthorizationTransactionDAO;
  const connection = yield* FellowshipLogsConnection;
  const mainDatabase = yield* MainDatabase;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const pointSystemOptIn = yield* FellowshipLogsPointSystemOptIn;
  const protectedValueStorage = yield* ProtectedValueStorage;
  const systemBrowser = yield* SystemBrowser;
  const fellowshipRunTrackerClientId =
    yield* appConfig.fellowshipLogsOAuthClientId;

  yield* DateTime.now.pipe(
    E.flatMap(authorizationTransactionDAO.deleteExpired),
    E.catch((error) => {
      return E.logWarning(
        "Failed to delete expired Fellowship Logs authorizations.",
        { error: error.message },
      );
    }),
  );

  const serviceScope = yield* E.scope;
  const startLock = yield* Semaphore.make(1);
  const sessionRef = yield* SynchronizedRef.make(Option.none<ActiveSession>());
  const statusRef =
    yield* SubscriptionRef.make<FellowshipLogsAuthorizationStatus>({
      _tag: "Idle",
    });

  const getClientId = (target: StartAuthorizationTarget) => {
    if (target.profile === "OWN_CLIENT_USER") {
      return E.succeed(target.clientId);
    }

    return E.fromOption(fellowshipRunTrackerClientId).pipe(
      E.mapError(() => {
        return new FellowshipLogsAuthorizationNotConfiguredError({
          setting: "ClientId",
        });
      }),
    );
  };

  const endSession = E.fnUntraced(function* (
    session: ActiveSession,
    status: FellowshipLogsAuthorizationStatus,
  ) {
    const isActive = yield* SynchronizedRef.modify(sessionRef, (active) => {
      return Option.isSome(active) && active.value.scope === session.scope
        ? [true, Option.none<ActiveSession>()]
        : [false, active];
    });

    if (!isActive) {
      return;
    }

    yield* SubscriptionRef.set(statusRef, status);
    yield* Scope.close(session.scope, Exit.void).pipe(E.forkIn(serviceScope));
  });

  const publishOutcome = E.fnUntraced(function* (
    session: Option.Option<ActiveSession>,
    status: FellowshipLogsAuthorizationStatus,
  ) {
    if (Option.isSome(session)) {
      return yield* endSession(session.value, status);
    }

    yield* SubscriptionRef.set(statusRef, status);
  });

  const consumeTransaction = E.fnUntraced(function* (callbackUrl: string) {
    const now = yield* DateTime.now;
    const transactionOption = yield* authorizationTransactionDAO.get();

    if (Option.isNone(transactionOption)) {
      return { _tag: "Rejected", reason: "NoPendingAuthorization" } as const;
    }

    const transaction = transactionOption.value;
    const callback = parseAuthorizationCallback(
      callbackUrl,
      transaction.redirectUri,
    );

    if (callback === null) {
      return { _tag: "Rejected", reason: "InvalidCallback" } as const;
    }

    if (callback.state !== transaction.state) {
      return { _tag: "Rejected", reason: "StateMismatch" } as const;
    }

    yield* authorizationTransactionDAO.delete();

    if (DateTime.isLessThanOrEqualTo(transaction.expiresAt, now)) {
      return { _tag: "Rejected", reason: "Expired" } as const;
    }

    return { _tag: "Consumed", callback, transaction } as const;
  });

  const whileSessionActive = <Success, Failure>(
    session: Option.Option<ActiveSession>,
    effect: E.Effect<Success, Failure>,
  ): E.Effect<Success, Failure | FellowshipLogsAuthorizationCallbackError> => {
    if (Option.isNone(session)) {
      return effect;
    }

    return SynchronizedRef.modifyEffect(
      sessionRef,
      (
        active,
      ): E.Effect<
        readonly [Success, Option.Option<ActiveSession>],
        Failure | FellowshipLogsAuthorizationCallbackError
      > => {
        return Option.isSome(active) &&
          active.value.scope === session.value.scope
          ? effect.pipe(
              E.map((value) => {
                return [
                  value,
                  Option.some({ ...active.value, isSaved: true }),
                ] as const;
              }),
            )
          : E.fail(
              new FellowshipLogsAuthorizationCallbackError({
                reason: "NoPendingAuthorization",
              }),
            );
      },
    );
  };

  const completeTransaction = E.fnUntraced(function* (
    session: Option.Option<ActiveSession>,
    callbackUrl: string,
  ) {
    const consumed = yield* mainDatabase
      .withTransaction(consumeTransaction(callbackUrl))
      .pipe(E.mapError(mapAuthorizationError("Complete")));

    if (consumed._tag === "Rejected") {
      return yield* new FellowshipLogsAuthorizationCallbackError({
        reason: consumed.reason,
      });
    }

    const { callback, transaction } = consumed;

    if (callback._tag === "Denied") {
      return { _tag: "Denied", profile: transaction.profile } as const;
    }

    const verifierEnvelope = yield* decodeProtectedValue(
      transaction.protectedVerifier,
    ).pipe(E.mapError(mapAuthorizationError("Complete")));
    const codeVerifier = yield* protectedValueStorage
      .unprotect(transaction.protectedVerifier)
      .pipe(E.mapError(mapAuthorizationError("Complete")));

    const tokens = yield* oauthClient.exchangeCode({
      clientId: transaction.clientId,
      code: callback.code,
      codeVerifier,
      redirectUri: transaction.redirectUri,
    });
    const issuedAt = yield* DateTime.now;
    const currentUser = yield* oauthClient.getCurrentUser(tokens.accessToken);

    yield* whileSessionActive(
      session,
      connection.saveAuthorizedSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: DateTime.add(issuedAt, {
          seconds: tokens.expiresInSeconds,
        }),
        allowLocalFallback: verifierEnvelope.protection === "LOCAL_KEY",
        clientId: transaction.clientId,
        connectedUserId: currentUser.id,
        connectedUserName: currentUser.name,
        expectedGeneration: transaction.expectedGeneration,
        profile: transaction.profile,
        refreshToken: tokens.refreshToken,
      }),
    );

    const pointSystemOptInResult: FellowshipLogsAuthorizationPointSystemOptIn =
      yield* pointSystemOptIn.check().pipe(
        E.catch((error) => {
          return E.logWarning(
            "Could not check the Fellowship Logs point-system opt-in.",
            { errorTag: error._tag },
          ).pipe(E.as("UNCHECKED" as const));
        }),
      );

    return {
      _tag: "Connected",
      connectedUserName: currentUser.name,
      pointSystemOptIn: pointSystemOptInResult,
      profile: transaction.profile,
    } as const;
  });

  const processCallback = (
    session: Option.Option<ActiveSession>,
    callbackUrl: string,
  ) =>
    completeTransaction(session, callbackUrl).pipe(
      E.tap((completed) => {
        return publishOutcome(session, completed);
      }),
      E.tapError((error) => {
        const status = Option.match(session, {
          onNone: () => null,
          onSome: (active) => getFailureStatus(error, active.profile),
        });

        return status === null ? E.void : publishOutcome(session, status);
      }),
    );

  const consumeCallbacks = (
    session: ActiveSession,
    callbacks: Queue.Queue<string>,
  ): E.Effect<void> =>
    Queue.take(callbacks).pipe(
      E.flatMap((callbackUrl) => {
        return processCallback(Option.some(session), callbackUrl).pipe(
          E.asVoid,
          E.catch((error) => {
            return isRetryableCallbackError(error)
              ? consumeCallbacks(session, callbacks)
              : E.void;
          }),
        );
      }),
    );

  const expireSession = E.fnUntraced(function* (
    session: ActiveSession,
    expiresAt: DateTime.Utc,
  ) {
    const startedAt = yield* DateTime.now;

    yield* E.sleep(DateTime.distance(startedAt, expiresAt));

    const now = yield* DateTime.now;

    yield* authorizationTransactionDAO.deleteExpired(now).pipe(
      E.catch((error) => {
        return E.logWarning(
          "Failed to delete an expired Fellowship Logs authorization.",
          { error: error.message },
        );
      }),
    );
    yield* endSession(session, { _tag: "Expired", profile: session.profile });
  });

  const replaceActiveSession = E.fnUntraced(function* (session: ActiveSession) {
    const previous = yield* SynchronizedRef.getAndSet(
      sessionRef,
      Option.some(session),
    );

    if (Option.isSome(previous)) {
      yield* Scope.close(previous.value.scope, Exit.void);
    }
  });

  const startSession = E.fnUntraced(function* (
    scope: Scope.Closeable,
    options: StartAuthorizationOptions,
    clientId: FellowshipLogsClientId,
  ) {
    const callbacks = yield* Queue.unbounded<string>();
    const redirectUri = yield* listenForAuthorizationCallback((callbackUrl) => {
      Queue.offerUnsafe(callbacks, callbackUrl);
    }).pipe(Scope.provide(scope));

    const codeVerifier = yield* generateCodeVerifier;
    const state = yield* generateOAuthState;
    const codeChallenge = yield* deriveCodeChallenge(codeVerifier).pipe(
      E.mapError(mapAuthorizationError("Start")),
    );

    const protectedVerifier = yield* protectedValueStorage
      .protect(codeVerifier, {
        allowLocalFallback: options.allowLocalFallback,
      })
      .pipe(E.mapError(mapProtectionError));
    const { protection } = yield* decodeProtectedValue(protectedVerifier).pipe(
      E.mapError(mapAuthorizationError("Start")),
    );

    const createdAt = yield* DateTime.now;
    const expiresAt = DateTime.add(
      createdAt,
      AUTHORIZATION_TRANSACTION_LIFETIME,
    );

    const session: ActiveSession = {
      isSaved: false,
      profile: options.profile,
      scope,
    };

    yield* E.uninterruptible(
      E.gen(function* () {
        yield* authorizationTransactionDAO
          .replace({
            clientId,
            createdAt,
            expectedGeneration: options.expectedGeneration,
            expiresAt,
            profile: options.profile,
            protectedVerifier,
            redirectUri,
            state,
          })
          .pipe(E.mapError(mapAuthorizationError("Start")));
        yield* replaceActiveSession(session);
        yield* SubscriptionRef.set(statusRef, {
          _tag: "Pending",
          expiresAt,
          profile: options.profile,
        });
      }),
    );
    yield* consumeCallbacks(session, callbacks).pipe(E.forkIn(scope));
    yield* expireSession(session, expiresAt).pipe(E.forkIn(scope));

    return {
      authorizationUrl: buildAuthorizationUrl({
        clientId,
        codeChallenge,
        redirectUri,
        state,
      }),
      expiresAt,
      profile: options.profile,
      storageProtection: protection,
    };
  });

  const openBrowser = (authorizationUrl: Redacted.Redacted<string>) => {
    return systemBrowser.open(authorizationUrl).pipe(
      E.as<BrowserLaunch>("Opened"),
      E.catch((error) => E.succeed<BrowserLaunch>(error.reason)),
      E.timeoutOrElse({
        duration: BROWSER_LAUNCH_TIMEOUT,
        orElse: () => E.succeed<BrowserLaunch>("LaunchFailed"),
      }),
    );
  };

  const abandonSession = E.fnUntraced(function* (scope: Scope.Closeable) {
    const wasActive = yield* SynchronizedRef.modify(sessionRef, (active) => {
      return Option.isSome(active) && active.value.scope === scope
        ? [true, Option.none<ActiveSession>()]
        : [false, active];
    });

    if (wasActive) {
      yield* SubscriptionRef.set(statusRef, { _tag: "Idle" });
      yield* authorizationTransactionDAO.delete().pipe(
        E.catch((error) => {
          return E.logWarning(
            "Failed to delete an abandoned Fellowship Logs authorization.",
            { error: error.message },
          );
        }),
      );
    }

    yield* Scope.close(scope, Exit.void);
  });

  const start: FellowshipLogsAuthorizationShape["start"] = E.fn(
    "FellowshipLogsAuthorization.start",
  )(function* (options) {
    const clientId = yield* getClientId(options);
    const scope = yield* Scope.fork(serviceScope);

    return yield* E.gen(function* () {
      const prepared = yield* startLock.withPermit(
        startSession(scope, options, clientId),
      );
      const active = yield* SynchronizedRef.get(sessionRef);
      const browserLaunch = Option.exists(active, (session) => {
        return session.scope === scope;
      })
        ? yield* openBrowser(prepared.authorizationUrl)
        : ("LaunchFailed" as const);

      return { ...prepared, browserLaunch };
    }).pipe(E.onError(() => abandonSession(scope)));
  });

  const abandon: FellowshipLogsAuthorizationShape["abandon"] = E.fn(
    "FellowshipLogsAuthorization.abandon",
  )(function* () {
    const session = yield* SynchronizedRef.get(sessionRef);

    if (Option.isSome(session)) {
      yield* abandonSession(session.value.scope);
    }
  });

  const complete: FellowshipLogsAuthorizationShape["complete"] = E.fn(
    "FellowshipLogsAuthorization.complete",
  )(function* ({ callbackUrl }) {
    const session = yield* SynchronizedRef.get(sessionRef);

    return yield* processCallback(session, callbackUrl);
  });

  const cancel: FellowshipLogsAuthorizationShape["cancel"] = E.fn(
    "FellowshipLogsAuthorization.cancel",
  )(function* () {
    const session = yield* SynchronizedRef.modify(sessionRef, (active) => {
      return Option.isSome(active) && !active.value.isSaved
        ? [active, Option.none<ActiveSession>()]
        : [Option.none<ActiveSession>(), active];
    });

    if (Option.isSome(session)) {
      yield* SubscriptionRef.set(statusRef, {
        _tag: "Cancelled",
        profile: session.value.profile,
      });
      yield* Scope.close(session.value.scope, Exit.void);
    }

    return yield* authorizationTransactionDAO
      .delete()
      .pipe(E.mapError(mapAuthorizationError("Cancel")));
  });

  return {
    abandon,
    cancel,
    complete,
    getStatus: () => SubscriptionRef.get(statusRef),
    start,
    statusChanges: SubscriptionRef.changes(statusRef),
  } satisfies FellowshipLogsAuthorizationShape;
});

export class FellowshipLogsAuthorization extends Context.Service<
  FellowshipLogsAuthorization,
  FellowshipLogsAuthorizationShape
>()(
  "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service/FellowshipLogsAuthorization",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsAuthorization,
  );

  static readonly layerWith = ({
    protectedValueStorageLayer,
    systemBrowserLayer,
  }: {
    readonly protectedValueStorageLayer: Layer.Layer<ProtectedValueStorage>;
    readonly systemBrowserLayer: Layer.Layer<SystemBrowser>;
  }) =>
    this.layerNoDeps.pipe(
      Layer.provide(FellowshipLogsAuthorizationTransactionDAO.layer),
      Layer.provide(FellowshipLogsOAuthClient.layer),
      Layer.provide(protectedValueStorageLayer),
      Layer.provide(systemBrowserLayer),
    );
}
