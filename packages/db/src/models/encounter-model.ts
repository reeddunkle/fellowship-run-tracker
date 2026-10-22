import * as Model from "effect/schema/Model";

import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { UnitStatusSchema } from "@frt/shared/unit/unit-status-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export class EncounterModel extends Model.Class<EncounterModel>(
  "EncounterModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: UnitStatusSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
