import * as Schema from "effect/Schema";

import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import {
  DungeonIdSchema,
  DungeonLevelSchema,
} from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { MilestoneComparisonTimeSchema } from "@frt/shared/milestone/milestone-comparison-time-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const RequirementOccurrenceFields = {
  requiredCount: PositiveIntegerSchema,
  startOccurrence: PositiveIntegerSchema,
};

const AbilityActivatedRequirementSchema = Schema.Struct({
  abilityId: NonEmptyStringSchema,
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.ABILITY_ACTIVATED),
});

const DungeonStartRequirementSchema = Schema.Struct({
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_START),
});

const DungeonEndRequirementSchema = Schema.Struct({
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.DUNGEON_END),
});

const EncounterStartRequirementSchema = Schema.Struct({
  encounterId: NonEmptyStringSchema,
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_START),
});

const EncounterEndRequirementSchema = Schema.Struct({
  encounterId: NonEmptyStringSchema,
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.ENCOUNTER_END),
});

const UnitDeathRequirementSchema = Schema.Struct({
  ...RequirementOccurrenceFields,
  type: Schema.Literal(FELLOWSHIP_EVENT.UNIT_DEATH),
  unitTypeId: NonEmptyStringSchema,
});

const FellowshipRequirementSchema = Schema.Union([
  AbilityActivatedRequirementSchema,
  DungeonEndRequirementSchema,
  DungeonStartRequirementSchema,
  EncounterEndRequirementSchema,
  EncounterStartRequirementSchema,
  UnitDeathRequirementSchema,
]);

export type FellowshipRequirement = typeof FellowshipRequirementSchema.Type;

const FellowshipMilestoneDefinitionSchema = Schema.Struct({
  comparisonTime: MilestoneComparisonTimeSchema,
  label: NonEmptyStringSchema,
  requirements: Schema.NonEmptyArray(FellowshipRequirementSchema),
});

export type FellowshipMilestoneDefinition =
  typeof FellowshipMilestoneDefinitionSchema.Type;

export const FellowshipConfigurationFileSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: DungeonLevelSchema,
  milestones: Schema.Array(FellowshipMilestoneDefinitionSchema),
});
