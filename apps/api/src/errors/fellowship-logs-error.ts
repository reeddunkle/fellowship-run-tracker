import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";

import { type FellowshipLogsGraphQLError } from "@frt/api/services/fellowship-logs/validation/fellowship-logs-graphql-schema.ts";

const REQUEST_OPERATION_DESCRIPTIONS = {
  GetAccessToken: "get a Fellowship Logs access token",
  Query: "query Fellowship Logs",
  ReadFixture: "read a Fellowship Logs fixture",
} as const;

export class FellowshipLogsRequestError extends Data.TaggedError(
  "FellowshipLogsRequestError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof REQUEST_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${REQUEST_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

export type FellowshipLogsGraphQLResponseErrorReason =
  | "ErrorsReturned"
  | "FightMissingDifficultyLevel"
  | "FightNotFound"
  | "MissingData"
  | "MissingReportPages"
  | "ReportNotFound";

export class FellowshipLogsGraphQLResponseError extends Data.TaggedError(
  "FellowshipLogsGraphQLResponseError",
)<{
  readonly errors: ReadonlyArray<FellowshipLogsGraphQLError>;
  readonly fightId?: number;
  readonly reason: FellowshipLogsGraphQLResponseErrorReason;
  readonly reportCode?: string;
}> {
  override get message() {
    const report = `report "${this.reportCode}"`;
    const fight = `fight ${this.fightId}`;

    const messages: Record<FellowshipLogsGraphQLResponseErrorReason, string> = {
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

/**
 * Fellowship Logs turned a request away because the hourly points were used
 * up. Raised where responses are read, before the reset time is known.
 */
export class FellowshipLogsRateLimitRejectedError extends Data.TaggedError(
  "FellowshipLogsRateLimitRejectedError",
) {
  override get message() {
    return "Fellowship Logs rejected the request because the rate limit was reached.";
  }
}

export type FellowshipLogsRateLimitExceededErrorReason =
  | "PreflightExhausted"
  | "RejectedByApi";

export class FellowshipLogsRateLimitExceededError extends Data.TaggedError(
  "FellowshipLogsRateLimitExceededError",
)<{
  readonly reason: FellowshipLogsRateLimitExceededErrorReason;
  readonly resetsAt: DateTime.Utc;
}> {
  override get message() {
    const resetsAt = DateTime.formatIso(this.resetsAt);

    const messages: Record<FellowshipLogsRateLimitExceededErrorReason, string> =
      {
        PreflightExhausted: `Fellowship Logs points are used up until ${resetsAt}; the request was not sent.`,
        RejectedByApi: `Fellowship Logs rejected the request because points are used up until ${resetsAt}.`,
      };

    return messages[this.reason];
  }
}

export class FellowshipLogsEventDecodeError extends Data.TaggedError(
  "FellowshipLogsEventDecodeError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to decode Fellowship Logs events.";
  }
}
