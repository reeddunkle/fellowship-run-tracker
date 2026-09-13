import * as Schema from "effect/Schema";

export const CatalogNameSchema = Schema.Union([
  Schema.Literal("ABILITY"),
  Schema.Literal("DUNGEON"),
  Schema.Literal("ENCOUNTER"),
  Schema.Literal("UNIT"),
]);

export type CatalogName = typeof CatalogNameSchema.Type;
