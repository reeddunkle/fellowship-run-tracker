import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

import {
  DungeonIdSchema,
  DungeonLevelSchema,
} from "@/services/fellowship/validation/fellowship-common.ts";
import { RequirementEventTypeSchema } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import {
  IntegerFromStringSchema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";
import { ConfigurationLabelSchema } from "@/validation/configuration/configuration-label-schema.ts";
import { ComparisonTimeFormSchema } from "@/validation/milestone/comparison-time-form-schema.ts";

const PositiveIntegerFromStringSchema = IntegerFromStringSchema.pipe(
  Schema.decodeTo(PositiveIntegerSchema),
);

const DungeonLevelFromStringSchema = IntegerFromStringSchema.pipe(
  Schema.decodeTo(DungeonLevelSchema),
);

const RequirementEditorSchema = Schema.Struct({
  id: Schema.String,
  requiredCount: PositiveIntegerFromStringSchema,
  startOccurrence: PositiveIntegerFromStringSchema,
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
  dungeonLevel: DungeonLevelFromStringSchema,
  label: ConfigurationLabelSchema,
  milestones: Schema.Array(MilestoneEditorSchema),
});

type EncodedRequirementEditorValue = typeof RequirementEditorSchema.Encoded;

type EncodedMilestoneEditorValue = typeof MilestoneEditorSchema.Encoded;

export type RequirementEditorValue = EncodedRequirementEditorValue;

export type MilestoneEditorValue = Omit<
  EncodedMilestoneEditorValue,
  "requirements"
> & {
  requirements: Array<RequirementEditorValue>;
};

export type ConfigurationEditorValue = Omit<
  typeof ConfigurationEditorSchema.Encoded,
  "dungeonId" | "milestones"
> & {
  dungeonId: string;
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
