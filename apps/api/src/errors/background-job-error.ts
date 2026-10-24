import * as Data from "effect/Data";
import type * as DateTime from "effect/DateTime";

import { type BackgroundJobWaitingReason } from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";

export class BackgroundJobDeferredError extends Data.TaggedError(
  "BackgroundJobDeferredError",
)<{
  readonly availableAt: DateTime.Utc | null;
  readonly reason: Error & { readonly _tag: string };
  readonly waitingReason: BackgroundJobWaitingReason;
}> {
  // [KEEP] Sets the standard `Error.cause`, which `Cause.pretty` renders as a
  // nested `[cause]:` chain, so logs show the reason and anything beneath it.
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}

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
