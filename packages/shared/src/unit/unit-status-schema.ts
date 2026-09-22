import * as Schema from "effect/Schema";

export const UnitStatusSchema = Schema.Union([
  Schema.Literal("ACTIVE"),
  Schema.Literal("INACTIVE"),
]);
