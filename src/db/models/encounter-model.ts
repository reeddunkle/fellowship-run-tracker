import * as Model from "effect/unstable/schema/Model";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export class EncounterModel extends Model.Class<EncounterModel>(
  "EncounterModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
