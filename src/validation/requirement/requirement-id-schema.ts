import * as Schema from "effect/Schema";

export const RequirementIdSchema = Schema.String.pipe(
  Schema.brand("RequirementId"),
);

export type RequirementId = typeof RequirementIdSchema.Type;
