import * as Schema from "effect/Schema";

import { UnitStatusSchema } from "@frt/shared/unit/unit-status-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

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
