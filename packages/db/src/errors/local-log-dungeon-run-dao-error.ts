import * as Data from "effect/Data";

import {
  type DungeonRunNotFoundOrInactiveError,
  type DungeonRunNotReturnedAfterInsertError,
} from "@frt/db/errors/dungeon-run-error.ts";
import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";

export type LocalLogDungeonRunDAOErrorReason =
  | DungeonRunNotFoundOrInactiveError
  | DungeonRunNotReturnedAfterInsertError
  | UnexpectedDatabaseError;

export class LocalLogDungeonRunDAOError extends Data.TaggedError(
  "LocalLogDungeonRunDAOError",
)<{
  readonly reason: LocalLogDungeonRunDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
