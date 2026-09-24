import * as Data from "effect/Data";

import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

export class BackgroundJobNotFoundError extends Data.TaggedError(
  "BackgroundJobNotFoundError",
)<{
  readonly id: BackgroundJobId;
}> {
  override get message() {
    return `Background job not found: ${this.id}.`;
  }
}

export class BackgroundJobNotReturnedAfterInsertError extends Data.TaggedError(
  "BackgroundJobNotReturnedAfterInsertError",
)<{
  readonly id: BackgroundJobId;
}> {
  override get message() {
    return `Background job was not returned after insert: ${this.id}.`;
  }
}
