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

export type FellowshipLogsGatewayGraphQLResponseErrorReason =
  | "ErrorsReturned"
  | "FightMissingDifficultyLevel"
  | "FightNotFound"
  | "MissingData"
  | "MissingReportPages"
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
      MissingReportPages: "Fellowship Logs returned no report pages.",
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
  | "PreflightExhausted"
  | "RejectedByApi";

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
      PreflightExhausted: `Fellowship Logs points are used up until ${resetsAt}; the request was not sent.`,
      RejectedByApi: `Fellowship Logs rejected the request because points are used up until ${resetsAt}.`,
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
