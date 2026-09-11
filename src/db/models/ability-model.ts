import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export class AbilityModel extends Model.Class<AbilityModel>("AbilityModel")({
  createdAt: Model.DateTimeInsertFromNumber,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  unitId: Schema.NullOr(NonEmptyStringSchema),
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
