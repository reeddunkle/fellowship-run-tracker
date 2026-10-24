import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";

import { type FellowshipLogsGatewayGraphQLError } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";

const REQUEST_OPERATION_DESCRIPTIONS = {
  GetAccessToken: "get a Fellowship Logs access token",
  Query: "query Fellowship Logs",
  ReadFixture: "read a Fellowship Logs fixture",
} as const;

export class FellowshipLogsGatewayRequestError extends Data.TaggedError(
  "FellowshipLogsGatewayRequestError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof REQUEST_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${REQUEST_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

const ACCESS_REASON_DESCRIPTIONS = {
  ConnectionChanged:
    "The Fellowship Logs connection changed since this import was queued.",
  LocalProtectionAcknowledgementRequired:
    "Fellowship Logs credentials cannot be stored until local-key protection is acknowledged.",
  NotConnected: "Fellowship Logs is not connected.",
  ReauthorizationRequired: "Sign in to Fellowship Logs again.",
} as const;

export class FellowshipLogsGatewayAccessError extends Data.TaggedError(
  "FellowshipLogsGatewayAccessError",
)<{
  readonly cause: unknown;
  readonly reason: keyof typeof ACCESS_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return ACCESS_REASON_DESCRIPTIONS[this.reason];
  }
}

const POINT_POLICY_REASON_DESCRIPTIONS = {
  DirectiveNotApplicable:
    "The request was not sent because it cannot be limited to user points.",
  NonUserPointsRequired:
    "Fellowship Logs refused part of the request because it would spend points other than user points.",
  NotUserEligible:
    "The request was not sent because it selects fields that spend points other than user points.",
  PointSystemOptInRequired:
    "Fellowship Logs requires opting into its new point system before requests can spend only user points.",
} as const;

export type FellowshipLogsGatewayPointPolicyErrorReason =
  keyof typeof POINT_POLICY_REASON_DESCRIPTIONS;

export class FellowshipLogsGatewayPointPolicyError extends Data.TaggedError(
  "FellowshipLogsGatewayPointPolicyError",
)<{
  readonly reason: FellowshipLogsGatewayPointPolicyErrorReason;
}> {
  override get message() {
    return POINT_POLICY_REASON_DESCRIPTIONS[this.reason];
  }
}

export type FellowshipLogsGatewayGraphQLResponseErrorReason =
  | "ErrorsReturned"
  | "FightMissingDifficultyLevel"
  | "FightNotFound"
  | "MissingData"
  | "ReportNotFound";

export class FellowshipLogsGatewayGraphQLResponseError extends Data.TaggedError(
  "FellowshipLogsGatewayGraphQLResponseError",
)<{
  readonly errors: ReadonlyArray<FellowshipLogsGatewayGraphQLError>;
  readonly fightId?: number;
  readonly reason: FellowshipLogsGatewayGraphQLResponseErrorReason;
  readonly reportCode?: string;
}> {
  override get message() {
    const report = `report "${this.reportCode}"`;
    const fight = `fight ${this.fightId}`;

    const messages: Record<
      FellowshipLogsGatewayGraphQLResponseErrorReason,
      string
    > = {
      ErrorsReturned: "Fellowship Logs returned GraphQL errors.",
      FightMissingDifficultyLevel: `Fellowship Logs ${fight} in ${report} does not have a dungeon difficulty level.`,
      FightNotFound: `Fellowship Logs ${fight} was not found in ${report}.`,
      MissingData: "Fellowship Logs returned no GraphQL data.",
      ReportNotFound: `Fellowship Logs ${report} was not found.`,
    };

    return messages[this.reason];
  }
}

export class FellowshipLogsGatewayRateLimitRejectedError extends Data.TaggedError(
  "FellowshipLogsGatewayRateLimitRejectedError",
) {
  override get message() {
    return "Fellowship Logs rejected the request because the rate limit was reached.";
  }
}

export type FellowshipLogsGatewayRateLimitExceededErrorReason =
  | "ApplicationHoldUnavailable"
  | "PreflightExhausted"
  | "RejectedByApi"
  | "UserPointsExhausted"
  | "UserPointsRejectedByApi";

export class FellowshipLogsGatewayRateLimitExceededError extends Data.TaggedError(
  "FellowshipLogsGatewayRateLimitExceededError",
)<{
  readonly reason: FellowshipLogsGatewayRateLimitExceededErrorReason;
  readonly resetsAt: DateTime.Utc;
}> {
  override get message() {
    const resetsAt = DateTime.formatIso(this.resetsAt);

    const messages: Record<
      FellowshipLogsGatewayRateLimitExceededErrorReason,
      string
    > = {
      ApplicationHoldUnavailable: `Fellowship Logs has no application point free for the request hold until ${resetsAt}; the request was not sent.`,
      PreflightExhausted: `Fellowship Logs points are used up until ${resetsAt}; the request was not sent.`,
      RejectedByApi: `Fellowship Logs rejected the request because points are used up until ${resetsAt}.`,
      UserPointsExhausted: `Your Fellowship Logs user points are used up until ${resetsAt}; the request was not sent.`,
      UserPointsRejectedByApi: `Fellowship Logs rejected the request because your user points are used up until ${resetsAt}.`,
    };

    return messages[this.reason];
  }
}

export class FellowshipLogsGatewayReportChangedError extends Data.TaggedError(
  "FellowshipLogsGatewayReportChangedError",
)<{
  readonly fightId: number;
  readonly reportCode: string;
}> {
  override get message() {
    return `Fellowship Logs report "${this.reportCode}" changed partway through fetching fight ${this.fightId}.`;
  }
}

export class FellowshipLogsGatewayEventDecodeError extends Data.TaggedError(
  "FellowshipLogsGatewayEventDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode Fellowship Logs events.";
  }
}
