import * as Data from "effect/Data";

import {
  type BackgroundJobNotFoundError,
  type BackgroundJobNotReturnedAfterInsertError,
} from "@frt/db/errors/background-job-error.ts";
import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type BackgroundJobDAOErrorReason =
  | BackgroundJobNotFoundError
  | BackgroundJobNotReturnedAfterInsertError
  | UnexpectedDatabaseError;

export class BackgroundJobDAOError extends Data.TaggedError(
  "BackgroundJobDAOError",
)<{
  readonly reason: BackgroundJobDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
