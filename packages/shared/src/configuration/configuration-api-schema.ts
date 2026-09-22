import * as Schema from "effect/Schema";

import {
  DungeonIdSchema,
  DungeonLevelSchema,
} from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { FellowshipConfigurationFileSchema } from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { ConfigurationFingerprintSchema } from "@frt/shared/validation/configuration/configuration-fingerprint-schema.ts";
import { ConfigurationIdSchema } from "@frt/shared/validation/configuration/configuration-id-schema.ts";
import { ConfigurationLabelSchema } from "@frt/shared/validation/configuration/configuration-label-schema.ts";
import { MilestoneComparisonTimeSchema } from "@frt/shared/validation/milestone/milestone-comparison-time-schema.ts";

export const SaveConfigurationApiRequestSchema = Schema.Struct({
  configuration: FellowshipConfigurationFileSchema,
  label: ConfigurationLabelSchema,
});

export type SaveConfigurationApiRequest =
  typeof SaveConfigurationApiRequestSchema.Type;

export const DeleteConfigurationsByDungeonAndLevelApiRequestSchema =
  Schema.Struct({
    dungeonId: DungeonIdSchema,
    dungeonLevel: DungeonLevelSchema,
  });

export type DeleteConfigurationsByDungeonAndLevelApiRequest =
  typeof DeleteConfigurationsByDungeonAndLevelApiRequestSchema.Type;

const ConfigurationApiRequirementSchema = Schema.Struct({
  requiredCount: PositiveIntegerSchema,
  startOccurrence: PositiveIntegerSchema,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
});

export type ConfigurationApiRequirement =
  typeof ConfigurationApiRequirementSchema.Type;

const ConfigurationApiMilestoneSchema = Schema.Struct({
  comparisonTime: MilestoneComparisonTimeSchema,
  label: NonEmptyStringSchema,
  requirements: Schema.NonEmptyArray(ConfigurationApiRequirementSchema),
});

export type ConfigurationApiMilestone =
  typeof ConfigurationApiMilestoneSchema.Type;

export const ConfigurationApiConfigurationSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtcFromString,
  dungeonId: DungeonIdSchema,
  dungeonLevel: DungeonLevelSchema,
  fingerprint: ConfigurationFingerprintSchema,
  id: ConfigurationIdSchema,
  label: ConfigurationLabelSchema,
  milestones: Schema.Array(ConfigurationApiMilestoneSchema),
  updatedAt: Schema.DateTimeUtcFromString,
});

export type ConfigurationApiConfiguration =
  typeof ConfigurationApiConfigurationSchema.Type;

export const ConfigurationApiConfigurationListSchema = Schema.Array(
  ConfigurationApiConfigurationSchema,
);

export type ConfigurationApiConfigurationList =
  typeof ConfigurationApiConfigurationListSchema.Type;
