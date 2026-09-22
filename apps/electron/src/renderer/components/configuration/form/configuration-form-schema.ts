import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

import {
  DungeonIdSchema,
  DungeonLevelSchema,
} from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { RequirementEventTypeSchema } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";
import { ConfigurationLabelSchema } from "@frt/shared/validation/configuration/configuration-label-schema.ts";
import { ComparisonTimeFormSchema } from "@frt/shared/validation/milestone/comparison-time-form-schema.ts";

const RequirementEditorSchema = Schema.Struct({
  id: Schema.String,
  requiredCount: PositiveIntegerSchema,
  startOccurrence: PositiveIntegerSchema,
  targetId: NonEmptyStringSchema,
  type: RequirementEventTypeSchema,
});

const MilestoneEditorSchema = Schema.Struct({
  comparisonTime: ComparisonTimeFormSchema,
  id: Schema.String,
  label: NonEmptyStringSchema,
  requirements: Schema.NonEmptyArray(RequirementEditorSchema),
});

export const ConfigurationEditorSchema = Schema.Struct({
  dungeonId: DungeonIdSchema,
  dungeonLevel: DungeonLevelSchema,
  label: ConfigurationLabelSchema,
  milestones: Schema.Array(MilestoneEditorSchema),
});

type EncodedRequirementEditorValue = typeof RequirementEditorSchema.Encoded;

type EncodedMilestoneEditorValue = typeof MilestoneEditorSchema.Encoded;

export type RequirementEditorValue = Omit<
  EncodedRequirementEditorValue,
  "requiredCount" | "startOccurrence"
> & {
  requiredCount: number | undefined;
  startOccurrence: number | undefined;
};

export type MilestoneEditorValue = Omit<
  EncodedMilestoneEditorValue,
  "requirements"
> & {
  requirements: Array<RequirementEditorValue>;
};

export type ConfigurationEditorValue = Omit<
  typeof ConfigurationEditorSchema.Encoded,
  "dungeonId" | "dungeonLevel" | "milestones"
> & {
  dungeonId: string;
  dungeonLevel: number | undefined;
  milestones: Array<MilestoneEditorValue>;
};

export type DecodedConfigurationEditorValue =
  typeof ConfigurationEditorSchema.Type;

const effectStandardSchema = Schema.toStandardSchemaV1(
  ConfigurationEditorSchema,
);

export const ConfigurationEditorStandardSchema: StandardSchemaV1<
  ConfigurationEditorValue,
  DecodedConfigurationEditorValue
> = {
  "~standard": {
    ...effectStandardSchema["~standard"],

    types: {
      input: undefined as unknown as ConfigurationEditorValue,
      output: undefined as unknown as DecodedConfigurationEditorValue,
    },

    validate: (value) => {
      return effectStandardSchema["~standard"].validate(value);
    },
  },
};
