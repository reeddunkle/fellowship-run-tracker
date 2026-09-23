import * as Data from "effect/Data";
import type * as DateTime from "effect/DateTime";

import { type FellowshipLogsRateLimitExceededError } from "@frt/api/errors/fellowship-logs-error.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

const BACKGROUND_JOB_OPERATION_DESCRIPTIONS = {
  Cancel: "cancel a background job",
  Dismiss: "dismiss a background job",
  List: "list background jobs",
  Offer: "queue a background job",
  Retry: "retry a background job",
} as const;

export class BackgroundJobError extends Data.TaggedError("BackgroundJobError")<{
  readonly cause: unknown;
  readonly operation: keyof typeof BACKGROUND_JOB_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${BACKGROUND_JOB_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

/*
 * The job doesn't exist, or isn't in a state the operation applies to (e.g.
 * cancelling a job that already finished).
 */
export class BackgroundJobNotFoundError extends Data.TaggedError(
  "BackgroundJobNotFoundError",
)<{
  readonly id: BackgroundJobId;
  readonly operation: keyof typeof BACKGROUND_JOB_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Could not ${BACKGROUND_JOB_OPERATION_DESCRIPTIONS[this.operation]}: ${this.id} was not found in a state that allows it.`;
  }
}

export type BackgroundJobDeferredErrorReason =
  FellowshipLogsRateLimitExceededError;

/*
 * A job can't make progress until `availableAt`, so it should wait rather
 * than fail. The reason is stored on the waiting job for the UI.
 */
export class BackgroundJobDeferredError extends Data.TaggedError(
  "BackgroundJobDeferredError",
)<{
  readonly availableAt: DateTime.Utc;
  readonly reason: BackgroundJobDeferredErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}

/*
 * Failure summaries stored on a job row when the job itself did not produce
 * the failure.
 */

export class BackgroundJobAttemptsExhaustedError extends Data.TaggedError(
  "BackgroundJobAttemptsExhaustedError",
)<{
  readonly maxAttempts: number;
}> {
  override get message() {
    return `The job was interrupted ${this.maxAttempts} times and will not be retried automatically.`;
  }
}

export class BackgroundJobInvalidPayloadError extends Data.TaggedError(
  "BackgroundJobInvalidPayloadError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "The job's stored payload could not be read.";
  }
}

export class BackgroundJobUnexpectedError extends Data.TaggedError(
  "BackgroundJobUnexpectedError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "The job failed unexpectedly.";
  }
}
