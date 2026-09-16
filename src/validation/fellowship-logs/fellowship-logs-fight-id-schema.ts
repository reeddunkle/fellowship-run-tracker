import * as Schema from "effect/Schema";

import { PositiveIntegerSchema } from "@/validation/common-schemas.ts";

export const FellowshipLogsFightIdSchema = PositiveIntegerSchema.pipe(
  Schema.brand("FellowshipLogsFightId"),
);

export type FellowshipLogsFightId = typeof FellowshipLogsFightIdSchema.Type;
