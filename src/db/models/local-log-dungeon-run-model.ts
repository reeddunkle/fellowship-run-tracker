import * as Model from "effect/unstable/schema/Model";

import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonRunStatusSchema } from "@/validation/dungeon-run/dungeon-run-status-schema.ts";

export class LocalLogDungeonRunModel extends Model.Class<LocalLogDungeonRunModel>(
  "LocalLogDungeonRunModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonRunId: DungeonRunIdSchema,
  status: DungeonRunStatusSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
