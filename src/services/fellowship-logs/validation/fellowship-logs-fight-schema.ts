import * as Schema from "effect/Schema";

import { NonNegativeIntegerSchema } from "@/validation/common-schemas.ts";

const FellowshipLogsFightSchema = Schema.Struct({
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  startTime: NonNegativeIntegerSchema,
});

export const FellowshipLogsFightResponseDataSchema = Schema.Struct({
  reportData: Schema.Struct({
    report: Schema.Struct({
      fights: Schema.Array(FellowshipLogsFightSchema),
    }).pipe(Schema.NullOr),
  }),
});
