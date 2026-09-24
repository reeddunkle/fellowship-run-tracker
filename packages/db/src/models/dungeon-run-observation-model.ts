import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { DungeonRunObservationIdSchema } from "@frt/db/validation/dungeon-run/dungeon-run-observation-id-schema.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

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
