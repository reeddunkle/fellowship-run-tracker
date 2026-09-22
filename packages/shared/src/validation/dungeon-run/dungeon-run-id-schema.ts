import * as Schema from "effect/Schema";

export const DungeonRunIdSchema = Schema.String.pipe(
  Schema.brand("DungeonRunId"),
);

export type DungeonRunId = typeof DungeonRunIdSchema.Type;
