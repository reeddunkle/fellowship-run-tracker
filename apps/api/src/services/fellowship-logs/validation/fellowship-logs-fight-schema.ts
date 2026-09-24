import * as Schema from "effect/Schema";

import { withRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsFightSchema = Schema.Struct({
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  inProgress: Schema.Boolean,
  startTime: NonNegativeIntegerSchema,
});

export const FellowshipLogsFightResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Struct({
      endTime: NonNegativeIntegerSchema,
      fights: Schema.Array(FellowshipLogsFightSchema),
    }).pipe(Schema.NullOr),
  }),
});
