import type * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import {
  FellowshipLogsGatewayAccessError,
  FellowshipLogsGatewayPointPolicyError,
  FellowshipLogsGatewayRateLimitExceededError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { type BackgroundJobWaitingReason } from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";

export type FellowshipLogsGatewayWaitCause =
  | FellowshipLogsGatewayAccessError
  | FellowshipLogsGatewayPointPolicyError
  | FellowshipLogsGatewayRateLimitExceededError;

export type FellowshipLogsGatewayWait = {
  readonly availableAt: DateTime.Utc | null;
  readonly cause: FellowshipLogsGatewayWaitCause;
  readonly waitingReason: BackgroundJobWaitingReason;
};

const ACCESS_WAITING_REASONS = {
  ConnectionChanged: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
  LocalProtectionAcknowledgementRequired:
    "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
  NotConnected: "CONNECTION_REQUIRED",
  ReauthorizationRequired: "REAUTHORIZATION_REQUIRED",
} as const satisfies Record<
  FellowshipLogsGatewayAccessError["reason"],
  BackgroundJobWaitingReason
>;

const RATE_LIMIT_WAITING_REASONS = {
  ApplicationHoldUnavailable: "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
  PreflightExhausted: "APPLICATION_QUOTA_RESET",
  RejectedByApi: "APPLICATION_QUOTA_RESET",
  UserPointsExhausted: "USER_QUOTA_RESET",
  UserPointsRejectedByApi: "USER_QUOTA_RESET",
} as const satisfies Record<
  FellowshipLogsGatewayRateLimitExceededError["reason"],
  BackgroundJobWaitingReason
>;

export function getFellowshipLogsGatewayWait(
  error: unknown,
): Option.Option<FellowshipLogsGatewayWait> {
  if (error instanceof FellowshipLogsGatewayAccessError) {
    return Option.some({
      availableAt: null,
      cause: error,
      waitingReason: ACCESS_WAITING_REASONS[error.reason],
    });
  }

  if (
    error instanceof FellowshipLogsGatewayPointPolicyError &&
    error.reason === "PointSystemOptInRequired"
  ) {
    return Option.some({
      availableAt: null,
      cause: error,
      waitingReason: "POINT_SYSTEM_OPT_IN_REQUIRED",
    });
  }

  if (error instanceof FellowshipLogsGatewayRateLimitExceededError) {
    return Option.some({
      availableAt: error.resetsAt,
      cause: error,
      waitingReason: RATE_LIMIT_WAITING_REASONS[error.reason],
    });
  }

  return Option.none();
}
