import * as Data from "effect/Data";

import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type FellowshipLogsResponseDAOErrorReason = UnexpectedDatabaseError;

export class FellowshipLogsResponseDAOError extends Data.TaggedError(
  "FellowshipLogsResponseDAOError",
)<{
  readonly reason: FellowshipLogsResponseDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
