import * as Schema from "effect/Schema";

import { UUID7Schema } from "@/validation/common-schemas.ts";

export const ConfigurationDefinitionIdSchema = UUID7Schema.pipe(
  Schema.brand("ConfigurationDefinitionId"),
);

export type ConfigurationDefinitionId =
  typeof ConfigurationDefinitionIdSchema.Type;
