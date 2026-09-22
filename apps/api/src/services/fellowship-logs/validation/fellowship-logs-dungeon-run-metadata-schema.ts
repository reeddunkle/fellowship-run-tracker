import * as Schema from "effect/Schema";

import { withRateLimitData } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/validation/common-schemas.ts";

const FellowshipLogsDungeonRunMetadataFightSchema = Schema.Struct({
  difficultyLevel: Schema.NullOr(Schema.Int),
  encounterID: Schema.Int,
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  startTime: NonNegativeIntegerSchema,
});

export const FellowshipLogsDungeonRunMetadataResponseDataSchema =
  withRateLimitData({
    reportData: Schema.Struct({
      report: Schema.Struct({
        fights: Schema.Array(FellowshipLogsDungeonRunMetadataFightSchema),
        startTime: NonNegativeIntegerSchema,
      }).pipe(Schema.NullOr),
    }),
  });
