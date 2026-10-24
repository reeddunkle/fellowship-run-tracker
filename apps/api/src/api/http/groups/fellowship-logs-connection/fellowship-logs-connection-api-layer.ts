import * as E from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import type * as Layer from "effect/Layer";
import * as Match from "effect/Match";

import { mapFellowshipLogsGatewayApiError } from "@frt/api/api/http/groups/fellowship-logs/map-fellowship-logs-gateway-api-error.ts";
import { type FellowshipLogsAuthorizationNotConfiguredError } from "@frt/api/errors/fellowship-logs-authorization-error.ts";
import {
  type FellowshipLogsConnectionChangedError,
  type FellowshipLogsConnectionReplacementRequiredError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { type LocalProtectionAcknowledgementRequiredError } from "@frt/api/errors/protected-value-storage-error.ts";
import { type CompleteAuthorizationError } from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import {
  FellowshipLogsConnectionManager,
  type SaveOwnClientError,
} from "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service.ts";
import {
  FellowshipLogsApiAuthorizationCallbackInvalidError,
  FellowshipLogsApiAuthorizationFailedError,
  FellowshipLogsApiAuthorizationNotConfiguredError,
  FellowshipLogsApiAuthorizationNotPendingError,
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

const PROVIDER_FAILURES = {
  Rejected: "PROVIDER_REJECTED",
  Unavailable: "PROVIDER_UNAVAILABLE",
  UnexpectedResponse: "PROVIDER_UNEXPECTED_RESPONSE",
} as const satisfies Record<
  FellowshipLogsOAuthProviderError["reason"],
  FellowshipLogsApiAuthorizationFailedError["failure"]
>;

const CALLBACK_INVALID_REASONS = {
  InvalidCallback: "INVALID_CALLBACK",
  StateMismatch: "STATE_MISMATCH",
} as const;

const NOT_PENDING_REASONS = {
  Expired: "EXPIRED",
  NoPendingAuthorization: "NO_PENDING_AUTHORIZATION",
} as const;

const logInternalServerError = E.fnUntraced(function* (error: {
  readonly _tag: string;
  readonly message: string;
}) {
  yield* E.logError("Fellowship Logs connection operation failed.", {
    errorTag: error._tag,
    message: error.message,
  });

  return yield* new HttpApiError.InternalServerError();
});

function mapReplacementRequired(
  error: FellowshipLogsConnectionReplacementRequiredError,
) {
  return E.fail(
    new FellowshipLogsApiConnectionReplacementConfirmationRequiredError({
      currentProfile: error.currentProfile,
    }),
  );
}

function mapConnectionChanged(_error: FellowshipLogsConnectionChangedError) {
  return E.fail(new FellowshipLogsApiConnectionChangedError());
}

function mapLocalProtectionAcknowledgementRequired(
  _error: LocalProtectionAcknowledgementRequiredError,
) {
  return E.fail(
    new FellowshipLogsApiLocalProtectionAcknowledgementRequiredError(),
  );
}

function mapNotConfigured(
  _error: FellowshipLogsAuthorizationNotConfiguredError,
) {
  return E.fail(new FellowshipLogsApiAuthorizationNotConfiguredError());
}

function mapCompleteAuthorizationError(
  error: CompleteAuthorizationError,
): E.Effect<
  never,
  | FellowshipLogsApiAuthorizationCallbackInvalidError
  | FellowshipLogsApiAuthorizationFailedError
  | FellowshipLogsApiAuthorizationNotPendingError
  | FellowshipLogsApiConnectionChangedError
  | FellowshipLogsApiLocalProtectionAcknowledgementRequiredError
  | HttpApiError.InternalServerError
> {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      FellowshipLogsAuthorizationCallbackError: (callbackError) => {
        return callbackError.reason === "Expired" ||
          callbackError.reason === "NoPendingAuthorization"
          ? E.fail(
              new FellowshipLogsApiAuthorizationNotPendingError({
                reason: NOT_PENDING_REASONS[callbackError.reason],
              }),
            )
          : E.fail(
              new FellowshipLogsApiAuthorizationCallbackInvalidError({
                reason: CALLBACK_INVALID_REASONS[callbackError.reason],
              }),
            );
      },
      FellowshipLogsAuthorizationError: logInternalServerError,
      FellowshipLogsConnectionChangedError: mapConnectionChanged,
      FellowshipLogsConnectionError: logInternalServerError,
      FellowshipLogsOAuthProviderError: (providerError) =>
        E.fail(
          new FellowshipLogsApiAuthorizationFailedError({
            failure: PROVIDER_FAILURES[providerError.reason],
          }),
        ),
      LocalProtectionAcknowledgementRequiredError:
        mapLocalProtectionAcknowledgementRequired,
    }),
  );
}

function mapSaveOwnClientError(
  error: SaveOwnClientError,
): E.Effect<
  never,
  | FellowshipLogsApiAuthorizationFailedError
  | FellowshipLogsApiConnectionChangedError
  | FellowshipLogsApiConnectionReplacementConfirmationRequiredError
  | FellowshipLogsApiInvalidCredentialsError
  | FellowshipLogsApiLocalProtectionAcknowledgementRequiredError
  | HttpApiError.InternalServerError
> {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      FellowshipLogsConnectionChangedError: mapConnectionChanged,
      FellowshipLogsConnectionError: logInternalServerError,
      FellowshipLogsConnectionReplacementRequiredError: mapReplacementRequired,
      FellowshipLogsOAuthProviderError: (providerError) =>
        providerError.reason === "Rejected"
          ? E.fail(new FellowshipLogsApiInvalidCredentialsError())
          : E.fail(
              new FellowshipLogsApiAuthorizationFailedError({
                failure: PROVIDER_FAILURES[providerError.reason],
              }),
            ),
      LocalProtectionAcknowledgementRequiredError:
        mapLocalProtectionAcknowledgementRequired,
    }),
  );
}

const FellowshipLogsConnectionApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "fellowshipLogsConnection",
  E.fnUntraced(function* (handlers) {
    const connectionManager = yield* FellowshipLogsConnectionManager;

    return handlers
      .handle("getFellowshipLogsConnection", () => {
        return connectionManager
          .getStatus()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("startFellowshipLogsAuthorization", ({ payload }) => {
        return connectionManager.startAuthorization(payload).pipe(
          E.catchTags({
            FellowshipLogsAuthorizationError: logInternalServerError,
            FellowshipLogsAuthorizationNotConfiguredError: mapNotConfigured,
            FellowshipLogsConnectionChangedError: mapConnectionChanged,
            FellowshipLogsConnectionError: logInternalServerError,
            FellowshipLogsConnectionReplacementRequiredError:
              mapReplacementRequired,
            LocalProtectionAcknowledgementRequiredError:
              mapLocalProtectionAcknowledgementRequired,
          }),
        );
      })
      .handle("completeFellowshipLogsAuthorization", ({ payload }) => {
        return connectionManager
          .completeAuthorization(payload)
          .pipe(E.catch(mapCompleteAuthorizationError));
      })
      .handle("cancelFellowshipLogsAuthorization", () => {
        return connectionManager
          .cancelAuthorization()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("saveFellowshipLogsOwnClient", ({ payload }) => {
        return connectionManager
          .saveOwnClient(payload)
          .pipe(E.catch(mapSaveOwnClientError));
      })
      .handle("disconnectFellowshipLogs", () => {
        return connectionManager
          .disconnect()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("checkFellowshipLogsPointSystemOptIn", () => {
        return connectionManager
          .checkPointSystemOptIn()
          .pipe(E.catch(mapFellowshipLogsGatewayApiError));
      });
  }),
);

export const FellowshipLogsConnectionApiLayer: Layer.Layer<
  Layer.Success<typeof FellowshipLogsConnectionApiHandlersInferred>,
  Layer.Error<typeof FellowshipLogsConnectionApiHandlersInferred>,
  FellowshipLogsConnectionManager
> = FellowshipLogsConnectionApiHandlersInferred;
