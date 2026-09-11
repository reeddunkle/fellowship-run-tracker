import * as Data from "effect/Data";

import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

export class GenerateLSSUnknownDungeonError extends Data.TaggedError(
  "GenerateLSSUnknownDungeonError",
)<{
  readonly dungeonId: DungeonId;
}> {}
