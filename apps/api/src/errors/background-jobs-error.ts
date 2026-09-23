import * as Data from "effect/Data";

const BACKGROUND_JOBS_OPERATION_DESCRIPTIONS = {
  Offer: "queue a background job",
} as const;

export class BackgroundJobsError extends Data.TaggedError(
  "BackgroundJobsError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof BACKGROUND_JOBS_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${BACKGROUND_JOBS_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}
