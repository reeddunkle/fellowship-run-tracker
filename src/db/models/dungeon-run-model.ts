import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { DungeonIdSchema } from "@/services/fellowship/validation/fellowship-common.ts";
import { PositiveIntegerSchema } from "@/validation/common-schemas.ts";
import { ConfigurationDefinitionIdSchema } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonRunStatusSchema } from "@/validation/dungeon-run/dungeon-run-status-schema.ts";

export class DungeonRunModel extends Model.Class<DungeonRunModel>(
  "DungeonRunModel",
)({
  configurationDefinitionId: ConfigurationDefinitionIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonId: DungeonIdSchema,
  dungeonLevel: PositiveIntegerSchema,
  endedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  id: Model.UuidV7Insert(DungeonRunIdSchema),
  startedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  status: DungeonRunStatusSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
