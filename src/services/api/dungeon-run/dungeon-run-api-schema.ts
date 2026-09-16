import * as Schema from "effect/Schema";

import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

const DungeonRunApiObservationStatisticsSchema = Schema.Struct({
  bestElapsedMilliseconds: Schema.Finite,
  meanElapsedMilliseconds: Schema.Finite,
  medianElapsedMilliseconds: Schema.Finite,
  occurrence: PositiveIntegerSchema,
  sampleCount: PositiveIntegerSchema,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
});

export type DungeonRunApiObservationStatistics =
  typeof DungeonRunApiObservationStatisticsSchema.Type;

export const DungeonRunApiHistorySchema = Schema.Struct({
  observations: Schema.Array(DungeonRunApiObservationStatisticsSchema),
});

export type DungeonRunApiHistory = typeof DungeonRunApiHistorySchema.Type;
