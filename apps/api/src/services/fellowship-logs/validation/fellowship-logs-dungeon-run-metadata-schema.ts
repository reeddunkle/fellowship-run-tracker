import * as Schema from "effect/Schema";

import { withRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsDungeonRunMetadataFightSchema = Schema.Struct({
  difficultyLevel: Schema.NullOr(Schema.Int),
  encounterID: Schema.Int,
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  inProgress: Schema.Boolean,
  startTime: NonNegativeIntegerSchema,
});

export const FellowshipLogsDungeonRunMetadataResponseDataSchema =
  withRateLimitData({
    reportData: Schema.Struct({
      report: Schema.Struct({
        endTime: NonNegativeIntegerSchema,
        fights: Schema.Array(FellowshipLogsDungeonRunMetadataFightSchema),
        startTime: NonNegativeIntegerSchema,
      }).pipe(Schema.NullOr),
    }),
  });
