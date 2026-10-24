import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import {
  type FellowshipLogsNoSignedInSessionError,
  type FellowshipLogsReauthorizationRequiredError,
} from "@frt/api/errors/fellowship-logs-access-token-error.ts";
import { type FellowshipLogsConnectionError } from "@frt/api/errors/fellowship-logs-connection-error.ts";
import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { type LocalProtectionAcknowledgementRequiredError } from "@frt/api/errors/protected-value-storage-error.ts";
import { FellowshipLogsAccessToken } from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import {
  ExpectedFellowshipLogsConnectionIdentity,
  getFellowshipLogsConnectionIdentity,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT,
  type FellowshipLogsGatewayRequestContext,
  getFellowshipLogsGatewayRequestPolicy,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import {
  type FellowshipLogsAuthorizedProfile,
  type FellowshipLogsConnectedUserId,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export type FellowshipLogsGatewayCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type FellowshipLogsGatewayAccess =
  | {
      readonly clientId: string;
      readonly clientSecret: Redacted.Redacted<string>;
      readonly profile: "OWN_CLIENT";
    }
  | {
      readonly accessToken: Redacted.Redacted<string>;
      readonly connectedUserId: FellowshipLogsConnectedUserId | null;
      readonly profile: FellowshipLogsAuthorizedProfile;
    };

type FellowshipLogsGatewayAccessSourceError =
  | FellowshipLogsGatewayAccessError
  | FellowshipLogsGatewayPointPolicyError
  | FellowshipLogsGatewayRequestError;

type ReportPointSystemOptInOptions = {
  readonly connectedUserId: FellowshipLogsConnectedUserId;
  readonly required: boolean;
};

export type FellowshipLogsGatewayAccessSource = {
  readonly get: () => E.Effect<
    FellowshipLogsGatewayAccess,
    FellowshipLogsGatewayAccessSourceError
  >;
  readonly getRequestContext: () => E.Effect<
    FellowshipLogsGatewayRequestContext,
    FellowshipLogsGatewayAccessSourceError
  >;
  readonly reportPointSystemOptIn: (
    options: ReportPointSystemOptInOptions,
  ) => E.Effect<void, FellowshipLogsGatewayAccessSourceError>;
  readonly reportRejected: (
    accessToken: Redacted.Redacted<string>,
  ) => E.Effect<void, FellowshipLogsGatewayAccessSourceError>;
  readonly withRequest: <A, Err, Requirements>(
    effect: E.Effect<A, Err, Requirements>,
  ) => E.Effect<A, Err, Requirements>;
};

export function makeClientCredentialsGatewayAccessSource(
  credentials: FellowshipLogsGatewayCredentials,
): FellowshipLogsGatewayAccessSource {
  return {
    get: () => {
      return E.succeed({
        clientId: credentials.clientId,
        clientSecret: Redacted.make(credentials.clientSecret),
        profile: "OWN_CLIENT",
      });
    },
    getRequestContext: () => {
      return E.succeed(DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT);
    },
    reportPointSystemOptIn: () => {
      return E.void;
    },
    reportRejected: () => {
      return E.void;
    },
    withRequest: (effect) => {
      return effect;
    },
  };
}

type ConnectionAccessError =
  | FellowshipLogsConnectionError
  | FellowshipLogsGatewayAccessError
  | FellowshipLogsGatewayPointPolicyError
  | FellowshipLogsNoSignedInSessionError
  | FellowshipLogsOAuthProviderError
  | FellowshipLogsReauthorizationRequiredError
  | LocalProtectionAcknowledgementRequiredError;

function mapConnectionAccessError(
  error: ConnectionAccessError,
): FellowshipLogsGatewayAccessSourceError {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      FellowshipLogsConnectionError: (connectionError) =>
        new FellowshipLogsGatewayRequestError({
          cause: connectionError,
          operation: "GetAccessToken",
        }),
      FellowshipLogsGatewayAccessError: (accessError) => accessError,
      FellowshipLogsGatewayPointPolicyError: (pointPolicyError) =>
        pointPolicyError,
      FellowshipLogsNoSignedInSessionError: (sessionError) =>
        new FellowshipLogsGatewayAccessError({
          cause: sessionError,
          reason: "NotConnected",
        }),
      FellowshipLogsOAuthProviderError: (providerError) =>
        new FellowshipLogsGatewayRequestError({
          cause: providerError,
          operation: "GetAccessToken",
        }),
      FellowshipLogsReauthorizationRequiredError: (reauthorizationError) =>
        new FellowshipLogsGatewayAccessError({
          cause: reauthorizationError,
          reason: "ReauthorizationRequired",
        }),
      LocalProtectionAcknowledgementRequiredError: (protectionError) =>
        new FellowshipLogsGatewayAccessError({
          cause: protectionError,
          reason: "LocalProtectionAcknowledgementRequired",
        }),
    }),
  );
}

type MakeConnectionGatewayAccessSourceOptions = {
  readonly refuseWithoutPointSystemOptIn: boolean;
};

export const makeConnectionGatewayAccessSource = E.fnUntraced(function* ({
  refuseWithoutPointSystemOptIn,
}: MakeConnectionGatewayAccessSourceOptions) {
  const accessToken = yield* FellowshipLogsAccessToken;
  const connection = yield* FellowshipLogsConnection;

  const get: FellowshipLogsGatewayAccessSource["get"] = E.fnUntraced(
    function* () {
      const credentials = yield* connection.getCredentials();

      if (Option.isNone(credentials)) {
        return yield* new FellowshipLogsGatewayAccessError({
          cause: null,
          reason: "NotConnected",
        });
      }

      const expectedIdentity = yield* ExpectedFellowshipLogsConnectionIdentity;

      if (
        expectedIdentity !== null &&
        getFellowshipLogsConnectionIdentity(credentials.value) !==
          expectedIdentity
      ) {
        return yield* new FellowshipLogsGatewayAccessError({
          cause: null,
          reason: "ConnectionChanged",
        });
      }

      if (credentials.value.profile === "OWN_CLIENT") {
        return {
          clientId: credentials.value.clientId,
          clientSecret: credentials.value.clientSecret,
          profile: credentials.value.profile,
        } satisfies FellowshipLogsGatewayAccess;
      }

      if (
        refuseWithoutPointSystemOptIn &&
        credentials.value.pointSystemOptInRequired
      ) {
        return yield* new FellowshipLogsGatewayPointPolicyError({
          reason: "PointSystemOptInRequired",
        });
      }

      const signedIn = yield* accessToken.get();

      return {
        accessToken: signedIn.accessToken,
        connectedUserId: credentials.value.connectedUserId,
        profile: signedIn.profile,
      } satisfies FellowshipLogsGatewayAccess;
    },
    E.mapError(mapConnectionAccessError),
  );

  const getRequestContext: FellowshipLogsGatewayAccessSource["getRequestContext"] =
    () => {
      return connection.getSummary().pipe(
        E.map((summary): FellowshipLogsGatewayRequestContext => {
          return Option.match(summary, {
            onNone: () => DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT,
            onSome: (value) => ({
              connectionIdentity: getFellowshipLogsConnectionIdentity(value),
              spending: getFellowshipLogsGatewayRequestPolicy(value.profile)
                .spending,
            }),
          });
        }),
        E.mapError(mapConnectionAccessError),
      );
    };

  const reportRejected: FellowshipLogsGatewayAccessSource["reportRejected"] = (
    rejectedAccessToken,
  ) => {
    return accessToken
      .reportRejected(rejectedAccessToken)
      .pipe(E.mapError(mapConnectionAccessError));
  };

  const reportPointSystemOptIn: FellowshipLogsGatewayAccessSource["reportPointSystemOptIn"] =
    ({ connectedUserId, required }) => {
      return connection
        .setPointSystemOptInRequired({ connectedUserId, required })
        .pipe(E.asVoid, E.mapError(mapConnectionAccessError));
    };

  return {
    get,
    getRequestContext,
    reportPointSystemOptIn,
    reportRejected,
    withRequest: connection.withRequestLease,
  } satisfies FellowshipLogsGatewayAccessSource;
});
