import * as Schema from "effect/Schema";

import { UnitStatusSchema } from "@/db/models/unit-model.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const UnitApiUnitSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtcFromString,
  dungeonIds: Schema.Array(NonEmptyStringSchema),
  groupKey: Schema.NullOr(NonEmptyStringSchema),
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: UnitStatusSchema,
  updatedAt: Schema.DateTimeUtcFromString,
  variant: Schema.NullOr(NonEmptyStringSchema),
});

export type UnitApiUnit = typeof UnitApiUnitSchema.Type;

export const UnitApiUnitListSchema = Schema.Array(UnitApiUnitSchema);

export type UnitApiUnitList = typeof UnitApiUnitListSchema.Type;
