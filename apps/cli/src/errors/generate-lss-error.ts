import * as Data from "effect/Data";

import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

export class GenerateLSSUnknownDungeonError extends Data.TaggedError(
  "GenerateLSSUnknownDungeonError",
)<{
  readonly dungeonId: DungeonId;
}> {
  override get message() {
    return `Unknown dungeon: ${this.dungeonId}.`;
  }
}
