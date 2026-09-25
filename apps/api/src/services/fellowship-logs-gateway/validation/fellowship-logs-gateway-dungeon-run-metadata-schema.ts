import * as Schema from "effect/Schema";

import { withRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayDungeonRunMetadataFightSchema = Schema.Struct({
  difficultyLevel: Schema.NullOr(Schema.Int),
  encounterID: Schema.Int,
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  inProgress: Schema.Boolean,
  startTime: NonNegativeIntegerSchema,
});

export const FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema =
  withRateLimitData({
    reportData: Schema.Struct({
      report: Schema.Struct({
        endTime: NonNegativeIntegerSchema,
        fights: Schema.Array(
          FellowshipLogsGatewayDungeonRunMetadataFightSchema,
        ),
        startTime: NonNegativeIntegerSchema,
      }).pipe(Schema.NullOr),
    }),
  });
