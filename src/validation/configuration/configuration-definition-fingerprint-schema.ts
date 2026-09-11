import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const ConfigurationDefinitionFingerprintSchema =
  NonEmptyStringSchema.pipe(Schema.brand("ConfigurationDefinitionFingerprint"));

export type ConfigurationDefinitionFingerprint =
  typeof ConfigurationDefinitionFingerprintSchema.Type;
