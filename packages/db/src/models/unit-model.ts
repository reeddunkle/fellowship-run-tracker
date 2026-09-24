import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { UnitStatusSchema } from "@frt/shared/unit/unit-status-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export class UnitModel extends Model.Class<UnitModel>("UnitModel")({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonIds: Schema.Array(NonEmptyStringSchema),
  groupKey: Schema.NullOr(NonEmptyStringSchema),
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: UnitStatusSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
  variant: Schema.NullOr(NonEmptyStringSchema),
}) {}
