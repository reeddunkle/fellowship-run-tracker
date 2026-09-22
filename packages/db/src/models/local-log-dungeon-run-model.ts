import * as Model from "effect/unstable/schema/Model";

import { DungeonRunStatusSchema } from "@frt/api-contract/validation/dungeon-run/dungeon-run-status-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

export class LocalLogDungeonRunModel extends Model.Class<LocalLogDungeonRunModel>(
  "LocalLogDungeonRunModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonRunId: DungeonRunIdSchema,
  status: DungeonRunStatusSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
