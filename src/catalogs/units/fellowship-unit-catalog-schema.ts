import * as Schema from "effect/Schema";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

const FellowshipUnitStatusSchema = Schema.Union([
  Schema.Literal("ACTIVE"),
  Schema.Literal("INACTIVE"),
]);

const FellowshipUnitCatalogEntrySchema = Schema.Struct({
  dungeonIds: Schema.Array(DungeonIdSchema),
  groupKey: Schema.NullOr(NonEmptyStringSchema),
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: FellowshipUnitStatusSchema,
  variant: Schema.NullOr(NonEmptyStringSchema),
});

export const FellowshipUnitCatalogSchema = Schema.Array(
  FellowshipUnitCatalogEntrySchema,
);

export type FellowshipUnitCatalog = typeof FellowshipUnitCatalogSchema.Type;
