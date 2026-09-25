import * as Data from "effect/Data";

import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type FellowshipLogsRequestDAOErrorReason = UnexpectedDatabaseError;

export class FellowshipLogsRequestDAOError extends Data.TaggedError(
  "FellowshipLogsRequestDAOError",
)<{
  readonly reason: FellowshipLogsRequestDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
