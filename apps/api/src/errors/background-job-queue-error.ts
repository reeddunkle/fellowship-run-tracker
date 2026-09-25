import * as Data from "effect/Data";

import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";

const BACKGROUND_JOB_QUEUE_OPERATION_DESCRIPTIONS = {
  Cancel: "cancel a background job",
  Dismiss: "dismiss a background job",
  List: "list background jobs",
  Offer: "queue a background job",
  Retry: "retry a background job",
} as const;

type BackgroundJobQueueOperation =
  keyof typeof BACKGROUND_JOB_QUEUE_OPERATION_DESCRIPTIONS;

export class BackgroundJobQueueError extends Data.TaggedError(
  "BackgroundJobQueueError",
)<{
  readonly cause: unknown;
  readonly operation: BackgroundJobQueueOperation;
}> {
  override get message() {
    return `Failed to ${BACKGROUND_JOB_QUEUE_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

export class BackgroundJobQueueNotFoundError extends Data.TaggedError(
  "BackgroundJobQueueNotFoundError",
)<{
  readonly id: BackgroundJobId;
  readonly operation: BackgroundJobQueueOperation;
}> {
  override get message() {
    return `Could not ${BACKGROUND_JOB_QUEUE_OPERATION_DESCRIPTIONS[this.operation]}: ${this.id} was not found in a state that allows it.`;
  }
}
