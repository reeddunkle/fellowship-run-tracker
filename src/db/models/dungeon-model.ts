import * as Model from "effect/unstable/schema/Model";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export class DungeonModel extends Model.Class<DungeonModel>("DungeonModel")({
  createdAt: Model.DateTimeInsertFromNumber,
  id: DungeonIdSchema,
  mapId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  updatedAt: Model.DateTimeInsertFromNumber,
}) {}
