import * as Data from "effect/Data";

import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

/* [KEEP]
 * Reasons shared by the dungeon run DAO errors (see their `reason` field).
 */

export class DungeonRunNotFoundError extends Data.TaggedError(
  "DungeonRunNotFoundError",
)<{
  readonly dungeonRunId: DungeonRunId;
}> {
  override get message() {
    return `Dungeon run not found: ${this.dungeonRunId}.`;
  }
}

export class DungeonRunNotFoundOrInactiveError extends Data.TaggedError(
  "DungeonRunNotFoundOrInactiveError",
)<{
  readonly dungeonRunId: DungeonRunId;
}> {
  override get message() {
    return `Dungeon run not found or no longer active: ${this.dungeonRunId}.`;
  }
}

export class DungeonRunNotReturnedAfterInsertError extends Data.TaggedError(
  "DungeonRunNotReturnedAfterInsertError",
)<{
  readonly dungeonRunId: DungeonRunId;
}> {
  override get message() {
    return `Dungeon run was not returned after insert: ${this.dungeonRunId}.`;
  }
}
