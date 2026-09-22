import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const ImportConfirmationFormSchema = Schema.Struct({
  isOwnRun: Schema.Boolean,
});

export type ImportConfirmationFormValue =
  typeof ImportConfirmationFormSchema.Encoded;

export type DecodedImportConfirmationFormValue =
  typeof ImportConfirmationFormSchema.Type;

const effectStandardSchema = Schema.toStandardSchemaV1(
  ImportConfirmationFormSchema,
);

export const ImportConfirmationFormStandardSchema: StandardSchemaV1<
  ImportConfirmationFormValue,
  DecodedImportConfirmationFormValue
> = {
  "~standard": {
    ...effectStandardSchema["~standard"],

    types: {
      input: undefined as unknown as ImportConfirmationFormValue,
      output: undefined as unknown as DecodedImportConfirmationFormValue,
    },

    validate: (value) => {
      return effectStandardSchema["~standard"].validate(value);
    },
  },
};
