import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Semaphore from "effect/Semaphore";

import {
  FellowshipLogsNoSignedInSessionError,
  FellowshipLogsReauthorizationRequiredError,
} from "@frt/api/errors/fellowship-logs-access-token-error.ts";
import { FellowshipLogsConnectionError } from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { LocalProtectionAcknowledgementRequiredError } from "@frt/api/errors/protected-value-storage-error.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsCredentials,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import { type FellowshipLogsAuthorizedProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const REFRESH_BEFORE_EXPIRY = Duration.minutes(5);

type SignedInCredentials = Extract<
  FellowshipLogsCredentials,
  { readonly tokens: unknown }
>;

type FellowshipLogsAccessTokenValue = {
  readonly accessToken: Redacted.Redacted<string>;
  readonly clientId: FellowshipLogsClientId;
  readonly profile: FellowshipLogsAuthorizedProfile;
};

type SessionError =
  | FellowshipLogsConnectionError
  | FellowshipLogsNoSignedInSessionError
  | FellowshipLogsReauthorizationRequiredError;

type GetAccessTokenError =
  | FellowshipLogsOAuthProviderError
  | LocalProtectionAcknowledgementRequiredError
  | SessionError;

export type FellowshipLogsAccessTokenShape = {
  readonly get: () => E.Effect<
    FellowshipLogsAccessTokenValue,
    GetAccessTokenError
  >;
  readonly reportRejected: (
    accessToken: Redacted.Redacted<string>,
  ) => E.Effect<void, SessionError>;
};

function isRejectedRefreshToken(error: FellowshipLogsOAuthProviderError) {
  return error.reason === "Rejected" && error.providerError === "invalid_grant";
}

const makeFellowshipLogsAccessToken = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const protectedValueStorage = yield* ProtectedValueStorage;
  const semaphore = yield* Semaphore.make(1);
  const serviceScope = yield* E.scope;

  const readSignedInCredentials = E.fnUntraced(function* () {
    const credentials = yield* connection.getCredentials();

    if (Option.isNone(credentials)) {
      return yield* new FellowshipLogsNoSignedInSessionError({
        reason: "NotConnected",
      });
    }

    if (credentials.value.profile === "OWN_CLIENT") {
      return yield* new FellowshipLogsNoSignedInSessionError({
        reason: "ClientSecretConnection",
      });
    }

    return credentials.value satisfies SignedInCredentials;
  });

  const requireTokens = E.fnUntraced(function* (
    credentials: SignedInCredentials,
  ) {
    if (credentials.tokens === null) {
      return yield* new FellowshipLogsReauthorizationRequiredError({
        profile: credentials.profile,
        reason: "PreviouslyRequired",
      });
    }

    return credentials.tokens;
  });

  const requireReauthorization = E.fnUntraced(function* (
    profile: FellowshipLogsAuthorizedProfile,
    accessToken: Redacted.Redacted<string>,
    reason: FellowshipLogsReauthorizationRequiredError["reason"],
  ) {
    const update = yield* connection.requireReauthorization({
      expectedAccessToken: accessToken,
    });

    if (update === "SESSION_CHANGED") {
      return update;
    }

    return yield* new FellowshipLogsReauthorizationRequiredError({
      profile,
      reason,
    });
  });

  const ensureRefreshedTokensCanBeStored = E.fnUntraced(function* () {
    const summary = yield* connection.getSummary();
    const status = yield* protectedValueStorage
      .getProtectionStatus()
      .pipe(
        E.mapError(
          (cause) =>
            new FellowshipLogsConnectionError({ cause, operation: "Save" }),
        ),
      );

    if (
      Option.exists(
        summary,
        (value) => value.storageProtection === "OS_BACKED",
      ) &&
      status.requiresLocalFallbackAcknowledgement
    ) {
      return yield* new LocalProtectionAcknowledgementRequiredError();
    }
  });

  const getCurrent: () => E.Effect<
    FellowshipLogsAccessTokenValue,
    GetAccessTokenError
  > = E.fnUntraced(function* () {
    const credentials = yield* readSignedInCredentials();
    const tokens = yield* requireTokens(credentials);
    const now = yield* DateTime.now;
    const value = {
      accessToken: tokens.accessToken,
      clientId: credentials.clientId,
      profile: credentials.profile,
    } satisfies FellowshipLogsAccessTokenValue;

    if (
      DateTime.isGreaterThan(
        tokens.accessTokenExpiresAt,
        DateTime.addDuration(now, REFRESH_BEFORE_EXPIRY),
      )
    ) {
      return value;
    }

    if (tokens.refreshToken === null) {
      if (DateTime.isGreaterThan(tokens.accessTokenExpiresAt, now)) {
        return value;
      }

      yield* requireReauthorization(
        credentials.profile,
        tokens.accessToken,
        "NoRefreshToken",
      );

      return yield* getCurrent();
    }

    yield* ensureRefreshedTokensCanBeStored();

    const refreshed = yield* oauthClient
      .refreshTokens({
        clientId: credentials.clientId,
        refreshToken: tokens.refreshToken,
      })
      .pipe(
        E.catchIf(isRejectedRefreshToken, () =>
          requireReauthorization(
            credentials.profile,
            tokens.accessToken,
            "RefreshTokenRejected",
          ),
        ),
      );

    if (refreshed === "SESSION_CHANGED") {
      return yield* getCurrent();
    }

    const issuedAt = yield* DateTime.now;
    const update = yield* connection.replaceTokens({
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: DateTime.add(issuedAt, {
        seconds: refreshed.expiresInSeconds,
      }),
      expectedAccessToken: tokens.accessToken,
      refreshToken: refreshed.refreshToken,
    });

    if (update === "SESSION_CHANGED") {
      return yield* getCurrent();
    }

    return { ...value, accessToken: refreshed.accessToken };
  });

  const get: FellowshipLogsAccessTokenShape["get"] = E.fn(
    "FellowshipLogsAccessToken.get",
  )(function* () {
    const current = yield* getCurrent().pipe(
      semaphore.withPermit,
      E.forkIn(serviceScope),
    );

    return yield* Fiber.join(current);
  });

  const reportRejected: FellowshipLogsAccessTokenShape["reportRejected"] = E.fn(
    "FellowshipLogsAccessToken.reportRejected",
  )(function* (accessToken) {
    const credentials = yield* readSignedInCredentials();

    yield* requireReauthorization(
      credentials.profile,
      accessToken,
      "AccessTokenRejected",
    );
  }, semaphore.withPermit);

  return {
    get,
    reportRejected,
  } satisfies FellowshipLogsAccessTokenShape;
});

export class FellowshipLogsAccessToken extends Context.Service<
  FellowshipLogsAccessToken,
  FellowshipLogsAccessTokenShape
>()(
  "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service/FellowshipLogsAccessToken",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsAccessToken,
  );

  static readonly layerWith = (
    protectedValueStorageLayer: Layer.Layer<ProtectedValueStorage>,
  ) =>
    this.layerNoDeps.pipe(
      Layer.provide(FellowshipLogsOAuthClient.layer),
      Layer.provide(protectedValueStorageLayer),
    );
}
