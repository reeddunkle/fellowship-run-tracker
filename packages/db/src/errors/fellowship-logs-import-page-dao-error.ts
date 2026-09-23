import * as Data from "effect/Data";

import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type FellowshipLogsImportPageDAOErrorReason = UnexpectedDatabaseError;

export class FellowshipLogsImportPageDAOError extends Data.TaggedError(
  "FellowshipLogsImportPageDAOError",
)<{
  readonly reason: FellowshipLogsImportPageDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
