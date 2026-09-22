import * as Data from "effect/Data";

import { type DungeonRunNotReturnedAfterInsertError } from "@frt/db/errors/dungeon-run-error.ts";
import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type FellowshipLogsDungeonRunDAOErrorReason =
  | DungeonRunNotReturnedAfterInsertError
  | UnexpectedDatabaseError;

export class FellowshipLogsDungeonRunDAOError extends Data.TaggedError(
  "FellowshipLogsDungeonRunDAOError",
)<{
  readonly reason: FellowshipLogsDungeonRunDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
