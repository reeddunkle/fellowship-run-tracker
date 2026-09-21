import { type StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

import { DungeonRunTimeColumnStateSchema } from "@/contracts/app-state/app-state-schema.ts";

export const DungeonRunTimeColumnsFormSchema = Schema.Struct({
  timeColumns: Schema.Array(DungeonRunTimeColumnStateSchema),
});

export type DungeonRunTimeColumnsFormValue =
  typeof DungeonRunTimeColumnsFormSchema.Type;

const effectStandardSchema = Schema.toStandardSchemaV1(
  DungeonRunTimeColumnsFormSchema,
);

export const DungeonRunTimeColumnsFormStandardSchema: StandardSchemaV1<
  DungeonRunTimeColumnsFormValue,
  DungeonRunTimeColumnsFormValue
> = {
  "~standard": {
    ...effectStandardSchema["~standard"],

    types: {
      input: undefined as unknown as DungeonRunTimeColumnsFormValue,
      output: undefined as unknown as DungeonRunTimeColumnsFormValue,
    },

    validate: (value) => {
      return effectStandardSchema["~standard"].validate(value);
    },
  },
};
