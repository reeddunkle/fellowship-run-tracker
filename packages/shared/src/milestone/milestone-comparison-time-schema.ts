import * as Schema from "effect/Schema";

import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

export const MilestoneComparisonTimeSchema = Schema.NullOr(
  NonNegativeIntegerSchema,
);
