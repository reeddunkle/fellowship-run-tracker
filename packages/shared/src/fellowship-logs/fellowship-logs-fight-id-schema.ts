import * as Schema from "effect/Schema";

import { PositiveIntegerSchema } from "@frt/shared/util/common-schemas.ts";

export const FellowshipLogsFightIdSchema = PositiveIntegerSchema.pipe(
  Schema.brand("FellowshipLogsFightId"),
);

export type FellowshipLogsFightId = typeof FellowshipLogsFightIdSchema.Type;
