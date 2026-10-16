import * as Model from "effect/schema/Model";

import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonRunStatusSchema } from "@frt/shared/dungeon-run/dungeon-run-status-schema.ts";

export class LocalLogDungeonRunModel extends Model.Class<LocalLogDungeonRunModel>(
  "LocalLogDungeonRunModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonRunId: DungeonRunIdSchema,
  status: DungeonRunStatusSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
