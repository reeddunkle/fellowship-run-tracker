import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import {
  FellowshipLogsConnectionChangedError,
  FellowshipLogsConnectionError,
  FellowshipLogsConnectionReplacementRequiredError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { type LocalProtectionAcknowledgementRequiredError } from "@frt/api/errors/protected-value-storage-error.ts";
import {
  type CompleteAuthorizationError,
  FellowshipLogsAuthorization,
  type StartAuthorizationError,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  createFellowshipLogsAuthorizationStatusApiResponse,
  createFellowshipLogsCompletedAuthorizationApiResponse,
  createFellowshipLogsConnectionApiResponse,
  createFellowshipLogsStartedAuthorizationApiResponse,
} from "@frt/api/services/fellowship-logs-connection-manager/create-fellowship-logs-connection-api-response.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import {
  type CheckPointSystemOptInError,
  FellowshipLogsPointSystemOptIn,
} from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsApiCompleteAuthorizationOptions,
  type FellowshipLogsApiCompletedAuthorization,
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiConnectionStatus,
  type FellowshipLogsApiPointSystemOptInCheck,
  type FellowshipLogsApiSaveOwnClientOptions,
  type FellowshipLogsApiStartAuthorizationOptions,
  type FellowshipLogsApiStartedAuthorization,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import {
  type FellowshipLogsConnectionGeneration,
  type FellowshipLogsConnectionProfile,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

type ReplacementCheckError =
  | FellowshipLogsConnectionChangedError
  | FellowshipLogsConnectionError
  | FellowshipLogsConnectionReplacementRequiredError;

export type SaveOwnClientError =
  | FellowshipLogsOAuthProviderError
  | LocalProtectionAcknowledgementRequiredError
  | ReplacementCheckError;

export type FellowshipLogsConnectionManagerShape = {
  readonly cancelAuthorization: () => E.Effect<
    void,
    E.Error<ReturnType<FellowshipLogsAuthorization["Service"]["cancel"]>>
  >;
  readonly checkPointSystemOptIn: () => E.Effect<
    FellowshipLogsApiPointSystemOptInCheck,
    CheckPointSystemOptInError
  >;
  readonly completeAuthorization: (
    options: FellowshipLogsApiCompleteAuthorizationOptions,
  ) => E.Effect<
    FellowshipLogsApiCompletedAuthorization,
    CompleteAuthorizationError
  >;
  readonly disconnect: () => E.Effect<void, FellowshipLogsConnectionError>;
  readonly getStatus: () => E.Effect<
    FellowshipLogsApiConnectionStatus,
    FellowshipLogsConnectionError
  >;
  readonly saveOwnClient: (
    options: FellowshipLogsApiSaveOwnClientOptions,
  ) => E.Effect<FellowshipLogsApiConnection, SaveOwnClientError>;
  readonly startAuthorization: (
    options: FellowshipLogsApiStartAuthorizationOptions,
  ) => E.Effect<
    FellowshipLogsApiStartedAuthorization,
    ReplacementCheckError | StartAuthorizationError
  >;
};

type ConnectionTarget = {
  readonly clientId: FellowshipLogsClientId | null;
  readonly expectedGeneration: FellowshipLogsConnectionGeneration | null;
  readonly profile: FellowshipLogsConnectionProfile;
  readonly replaceConnection: boolean;
};

const makeFellowshipLogsConnectionManager = E.gen(function* () {
  const authorization = yield* FellowshipLogsAuthorization;
  const connection = yield* FellowshipLogsConnection;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const pointSystemOptIn = yield* FellowshipLogsPointSystemOptIn;

  const ensureReplacementConfirmed = E.fnUntraced(function* ({
    clientId,
    expectedGeneration,
    profile,
    replaceConnection,
  }: ConnectionTarget) {
    const current = yield* connection.getSummary();
    const currentGeneration = Option.match(current, {
      onNone: () => null,
      onSome: (value) => value.generation,
    });

    if (currentGeneration !== expectedGeneration) {
      return yield* new FellowshipLogsConnectionChangedError();
    }

    if (Option.isNone(current) || replaceConnection) {
      return expectedGeneration;
    }

    const isSameConnection =
      current.value.profile === profile &&
      (clientId === null || current.value.clientId === clientId);

    if (!isSameConnection) {
      return yield* new FellowshipLogsConnectionReplacementRequiredError({
        currentProfile: current.value.profile,
      });
    }

    return expectedGeneration;
  });

  const getStatus: FellowshipLogsConnectionManagerShape["getStatus"] = E.fn(
    "FellowshipLogsConnectionManager.getStatus",
  )(function* () {
    const summary = yield* connection.getSummary();
    const authorizationStatus = yield* authorization.getStatus();

    return {
      authorization:
        createFellowshipLogsAuthorizationStatusApiResponse(authorizationStatus),
      connection: createFellowshipLogsConnectionApiResponse(summary),
    };
  });

  const startAuthorization: FellowshipLogsConnectionManagerShape["startAuthorization"] =
    E.fn("FellowshipLogsConnectionManager.startAuthorization")(
      function* (options) {
        const expectedGeneration = yield* ensureReplacementConfirmed({
          clientId:
            options.profile === "OWN_CLIENT_USER" ? options.clientId : null,
          expectedGeneration: options.expectedGeneration,
          profile: options.profile,
          replaceConnection: options.replaceConnection,
        });

        const started = yield* authorization.start(
          options.profile === "OWN_CLIENT_USER"
            ? {
                allowLocalFallback: options.allowLocalFallback,
                clientId: options.clientId,
                expectedGeneration,
                profile: options.profile,
              }
            : {
                allowLocalFallback: options.allowLocalFallback,
                expectedGeneration,
                profile: options.profile,
              },
        );

        return createFellowshipLogsStartedAuthorizationApiResponse(started);
      },
    );

  const completeAuthorization: FellowshipLogsConnectionManagerShape["completeAuthorization"] =
    E.fn("FellowshipLogsConnectionManager.completeAuthorization")(function* ({
      callbackUrl,
    }) {
      const completed = yield* authorization.complete({
        callbackUrl: Redacted.value(callbackUrl),
      });

      return createFellowshipLogsCompletedAuthorizationApiResponse(completed);
    });

  const saveOwnClient: FellowshipLogsConnectionManagerShape["saveOwnClient"] =
    E.fn("FellowshipLogsConnectionManager.saveOwnClient")(function* ({
      allowLocalFallback,
      clientId,
      clientSecret,
      expectedGeneration: observedGeneration,
      replaceConnection,
    }) {
      const expectedGeneration = yield* ensureReplacementConfirmed({
        clientId,
        expectedGeneration: observedGeneration,
        profile: "OWN_CLIENT",
        replaceConnection,
      });
      yield* oauthClient.checkClientCredentials({ clientId, clientSecret });
      yield* connection.saveOwnClient({
        allowLocalFallback,
        clientId,
        clientSecret,
        expectedGeneration,
      });

      const summary = yield* connection.getSummary();
      const saved = createFellowshipLogsConnectionApiResponse(summary);

      if (saved === null) {
        return yield* new FellowshipLogsConnectionError({
          cause: "The saved Fellowship Logs connection is missing.",
          operation: "Read",
        });
      }

      return saved;
    });

  const checkPointSystemOptIn: FellowshipLogsConnectionManagerShape["checkPointSystemOptIn"] =
    E.fn("FellowshipLogsConnectionManager.checkPointSystemOptIn")(function* () {
      const result = yield* pointSystemOptIn.check();

      return { result };
    });

  const disconnect: FellowshipLogsConnectionManagerShape["disconnect"] = E.fn(
    "FellowshipLogsConnectionManager.disconnect",
  )(function* () {
    yield* authorization.abandon();
    yield* connection.disconnect();
  });

  return {
    cancelAuthorization: authorization.cancel,
    checkPointSystemOptIn,
    completeAuthorization,
    disconnect,
    getStatus,
    saveOwnClient,
    startAuthorization,
  } satisfies FellowshipLogsConnectionManagerShape;
});

export class FellowshipLogsConnectionManager extends Context.Service<
  FellowshipLogsConnectionManager,
  FellowshipLogsConnectionManagerShape
>()(
  "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service/FellowshipLogsConnectionManager",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsConnectionManager,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsOAuthClient.layer),
  );
}
