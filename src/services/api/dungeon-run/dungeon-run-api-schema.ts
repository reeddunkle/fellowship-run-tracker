import * as Schema from "effect/Schema";

import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";
import { DungeonRunComparisonGroupSchema } from "@/validation/dungeon-run/dungeon-run-comparison-group-schema.ts";

export type DungeonRunApiComparisonGroup =
  typeof DungeonRunComparisonGroupSchema.Type;

const DungeonRunApiObservationStatisticsSchema = Schema.Struct({
  bestElapsedMilliseconds: Schema.Finite,
  comparisonGroup: DungeonRunComparisonGroupSchema,
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
  comparisonRunCount: NonNegativeIntegerSchema,
  comparisonSampleCount: NonNegativeIntegerSchema,
  observations: Schema.Array(DungeonRunApiObservationStatisticsSchema),
  ownRunCount: NonNegativeIntegerSchema,
  ownSampleCount: NonNegativeIntegerSchema,
});

export type DungeonRunApiHistory = typeof DungeonRunApiHistorySchema.Type;
