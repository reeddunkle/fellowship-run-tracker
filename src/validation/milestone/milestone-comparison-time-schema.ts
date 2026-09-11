import * as Schema from "effect/Schema";

import { NonNegativeIntegerSchema } from "@/validation/common-schemas.ts";

export const MilestoneComparisonTimeSchema = Schema.NullOr(
  NonNegativeIntegerSchema,
);
