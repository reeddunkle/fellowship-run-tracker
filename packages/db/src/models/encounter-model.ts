import * as Model from "effect/unstable/schema/Model";

import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export class EncounterModel extends Model.Class<EncounterModel>(
  "EncounterModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
