import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export const ConfigurationLabelSchema = NonEmptyStringSchema.pipe(
  Schema.brand("ConfigurationLabel"),
);

export type ConfigurationLabel = typeof ConfigurationLabelSchema.Type;
