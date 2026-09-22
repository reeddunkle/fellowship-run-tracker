import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import {
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  FellowshipLogsClientSecretSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";
import {
  EmptyStringSchema,
  IntegerFromStringSchema,
} from "@frt/shared/validation/common-schemas.ts";

const LiveSplitPortFromStringSchema = IntegerFromStringSchema.pipe(
  Schema.decodeTo(LiveSplitPortSchema),
);

const EmptyStringToNullSchema = EmptyStringSchema.pipe(
  Schema.decodeTo(
    Schema.Null,
    SchemaTransformation.transform({
      decode: () => null,
      encode: () => "",
    }),
  ),
);

const EmptyStringToUndefinedSchema = EmptyStringSchema.pipe(
  Schema.decodeTo(
    Schema.Undefined,
    SchemaTransformation.transform({
      decode: () => undefined,
      encode: () => "",
    }),
  ),
);

const FellowshipLogsClientSecretFromStringSchema = Schema.Union([
  EmptyStringToUndefinedSchema,
  FellowshipLogsClientSecretSchema,
  Schema.Null,
]);

const FellowshipLogsClientIdFromStringSchema = Schema.Union([
  EmptyStringToNullSchema,
  FellowshipLogsClientIdSchema,
]);

export const SettingsFormSchema = Schema.Struct({
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  fellowshipLogsClientId: FellowshipLogsClientIdFromStringSchema,
  fellowshipLogsClientSecret: FellowshipLogsClientSecretFromStringSchema,
  isLiveSplitEnabled: Schema.Boolean,
  liveSplitHost: LiveSplitHostSchema,
  liveSplitPort: LiveSplitPortFromStringSchema,
});

export type SettingsFormValue = typeof SettingsFormSchema.Encoded;

export type DecodedSettingsFormValue = typeof SettingsFormSchema.Type;

const effectStandardSchema = Schema.toStandardSchemaV1(SettingsFormSchema);

export const SettingsFormStandardSchema: StandardSchemaV1<
  SettingsFormValue,
  DecodedSettingsFormValue
> = {
  "~standard": {
    ...effectStandardSchema["~standard"],

    types: {
      input: undefined as unknown as SettingsFormValue,
      output: undefined as unknown as DecodedSettingsFormValue,
    },

    validate: (value) => {
      return effectStandardSchema["~standard"].validate(value);
    },
  },
};
