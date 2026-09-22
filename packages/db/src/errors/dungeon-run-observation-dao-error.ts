import * as Data from "effect/Data";

import { type DungeonRunNotFoundError } from "@frt/db/errors/dungeon-run-error.ts";
import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type DungeonRunObservationDAOErrorReason =
  | DungeonRunNotFoundError
  | UnexpectedDatabaseError;

export class DungeonRunObservationDAOError extends Data.TaggedError(
  "DungeonRunObservationDAOError",
)<{
  readonly reason: DungeonRunObservationDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
