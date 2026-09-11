import * as Schema from "effect/Schema";

export const DungeonRunStatusSchema = Schema.Literals([
  "ACTIVE",
  "COMPLETED",
  "EXITED",
  "INTERRUPTED",
]);
