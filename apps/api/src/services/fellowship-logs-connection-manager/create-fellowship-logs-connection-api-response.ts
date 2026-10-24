import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import {
  type CompletedAuthorization,
  type FellowshipLogsAuthorizationFailure,
  type FellowshipLogsAuthorizationStatus,
  type StartedAuthorization,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import { type FellowshipLogsConnectionSummary } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { getFellowshipLogsGatewayRequestPolicy } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";
import {
  type FellowshipLogsApiAuthorizationFailure,
  type FellowshipLogsApiAuthorizationStatus,
  type FellowshipLogsApiCompletedAuthorization,
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiStartedAuthorization,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

const AUTHORIZATION_FAILURES = {
  ConnectionChanged: "CONNECTION_CHANGED",
  LocalProtectionAcknowledgementRequired:
    "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
  OwnClientRejected: "OWN_CLIENT_REJECTED",
  ProviderRejected: "PROVIDER_REJECTED",
  ProviderUnavailable: "PROVIDER_UNAVAILABLE",
  ProviderUnexpectedResponse: "PROVIDER_UNEXPECTED_RESPONSE",
  Storage: "STORAGE",
} as const satisfies Record<
  FellowshipLogsAuthorizationFailure,
  FellowshipLogsApiAuthorizationFailure
>;

const BROWSER_LAUNCHES = {
  LaunchFailed: "LAUNCH_FAILED",
  Opened: "OPENED",
  Unavailable: "UNAVAILABLE",
} as const satisfies Record<
  StartedAuthorization["browserLaunch"],
  FellowshipLogsApiStartedAuthorization["browserLaunch"]
>;

export function createFellowshipLogsConnectionApiResponse(
  summary: Option.Option<FellowshipLogsConnectionSummary>,
): FellowshipLogsApiConnection | null {
  return Option.match(summary, {
    onNone: () => null,
    onSome: (value) => {
      return {
        clientId:
          value.profile === "FELLOWSHIP_RUN_TRACKER_USER"
            ? null
            : value.clientId,
        connectedUserName: value.connectedUserName,
        generation: value.generation,
        pointPolicyVersion: value.pointPolicyVersion,
        profile: value.profile,
        spending: getFellowshipLogsGatewayRequestPolicy(value.profile).spending,
        status: value.status,
        storageProtection: value.storageProtection,
      };
    },
  });
}

export function createFellowshipLogsAuthorizationStatusApiResponse(
  status: FellowshipLogsAuthorizationStatus,
): FellowshipLogsApiAuthorizationStatus {
  return Match.value(status).pipe(
    Match.tagsExhaustive({
      Cancelled: ({ profile }) => ({ profile, state: "CANCELLED" as const }),
      Connected: ({ connectedUserName, pointSystemOptIn, profile }) => ({
        connectedUserName,
        pointSystemOptIn,
        profile,
        state: "CONNECTED" as const,
      }),
      Denied: ({ profile }) => ({ profile, state: "DENIED" as const }),
      Expired: ({ profile }) => ({ profile, state: "EXPIRED" as const }),
      Failed: ({ failure, profile }) => ({
        failure: AUTHORIZATION_FAILURES[failure],
        profile,
        state: "FAILED" as const,
      }),
      Idle: () => ({ state: "IDLE" as const }),
      Pending: ({ expiresAt, profile }) => ({
        expiresAtMilliseconds: DateTime.toEpochMillis(expiresAt),
        profile,
        state: "PENDING",
      }),
    }),
  );
}

export function createFellowshipLogsStartedAuthorizationApiResponse(
  started: StartedAuthorization,
): FellowshipLogsApiStartedAuthorization {
  return {
    authorizationUrl: Redacted.value(started.authorizationUrl),
    browserLaunch: BROWSER_LAUNCHES[started.browserLaunch],
    expiresAtMilliseconds: DateTime.toEpochMillis(started.expiresAt),
    profile: started.profile,
    storageProtection: started.storageProtection,
  };
}

export function createFellowshipLogsCompletedAuthorizationApiResponse(
  completed: CompletedAuthorization,
): FellowshipLogsApiCompletedAuthorization {
  return completed._tag === "Connected"
    ? {
        connectedUserName: completed.connectedUserName,
        pointSystemOptIn: completed.pointSystemOptIn,
        profile: completed.profile,
        state: "CONNECTED",
      }
    : { profile: completed.profile, state: "DENIED" };
}
