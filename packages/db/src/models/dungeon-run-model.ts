import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { DungeonRunSourceSchema } from "@frt/db/validation/dungeon-run/dungeon-run-source-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonIdSchema } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import {
  BooleanIntSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

export class DungeonRunModel extends Model.Class<DungeonRunModel>(
  "DungeonRunModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  endedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  id: Model.UuidV7Insert(DungeonRunIdSchema),
  isOwnRun: BooleanIntSchema,
  source: DungeonRunSourceSchema,
  startedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
