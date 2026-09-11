import * as Data from "effect/Data";

import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

export class AutosplitUnknownDungeonError extends Data.TaggedError(
  "AutosplitUnknownDungeonError",
)<{
  readonly dungeonId: DungeonId;
}> {}
