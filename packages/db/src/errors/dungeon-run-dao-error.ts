import * as Data from "effect/Data";

import {
  type DungeonRunNotFoundError,
  type DungeonRunNotReturnedAfterInsertError,
} from "@frt/db/errors/dungeon-run-error.ts";
import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type DungeonRunDAOErrorReason =
  | DungeonRunNotFoundError
  | DungeonRunNotReturnedAfterInsertError
  | UnexpectedDatabaseError;

export class DungeonRunDAOError extends Data.TaggedError("DungeonRunDAOError")<{
  readonly reason: DungeonRunDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
