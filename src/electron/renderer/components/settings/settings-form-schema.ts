import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

import {
  FellowshipLogDirectorySchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";
import { IntegerFromStringSchema } from "@/validation/common-schemas.ts";

const LiveSplitPortFromStringSchema = IntegerFromStringSchema.pipe(
  Schema.decodeTo(LiveSplitPortSchema),
);

export const SettingsFormSchema = Schema.Struct({
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  isLiveSplitEnabled: Schema.Boolean,
  liveSplitsHost: LiveSplitHostSchema,
  liveSplitsPort: LiveSplitPortFromStringSchema,
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
