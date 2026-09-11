import * as Schema from "effect/Schema";

export const MilestoneIdSchema = Schema.String.pipe(
  Schema.brand("MilestoneId"),
);

export type MilestoneId = typeof MilestoneIdSchema.Type;
