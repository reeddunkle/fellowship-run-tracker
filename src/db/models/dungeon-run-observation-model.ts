import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { DungeonRunObservationIdSchema } from "@/validation/dungeon-run/dungeon-run-observation-id-schema.ts";

export class DungeonRunObservationModel extends Model.Class<DungeonRunObservationModel>(
  "DungeonRunObservationModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  dungeonRunId: DungeonRunIdSchema,
  id: Model.UuidV7Insert(DungeonRunObservationIdSchema),
  observedAt: Schema.DateTimeUtcFromMillis,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
}) {}
