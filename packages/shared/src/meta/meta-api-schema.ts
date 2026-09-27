import * as Schema from "effect/Schema";

import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

export const MetaApiMetaSchema = Schema.Struct({
  apiContractVersion: PositiveIntegerSchema,
  appVersion: NonEmptyStringSchema,
});
