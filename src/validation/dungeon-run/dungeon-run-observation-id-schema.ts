import * as Schema from "effect/Schema";

export const DungeonRunObservationIdSchema = Schema.String.pipe(
  Schema.brand("DungeonRunObservationId"),
);
