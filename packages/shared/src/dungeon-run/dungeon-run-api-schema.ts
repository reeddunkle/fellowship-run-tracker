import * as Schema from "effect/Schema";

import { DungeonRunComparisonGroupSchema } from "@frt/shared/dungeon-run/dungeon-run-comparison-group-schema.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

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
