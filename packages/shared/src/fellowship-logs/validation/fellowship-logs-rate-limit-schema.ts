import * as Schema from "effect/Schema";

import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/validation/common-schemas.ts";

const NonNegativeFiniteSchema = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

export const FellowshipLogsRateLimitDataSchema = Schema.Struct({
  limitPerHour: PositiveIntegerSchema,
  pointsResetIn: NonNegativeIntegerSchema,
  pointsSpentThisHour: NonNegativeFiniteSchema,
});

export type FellowshipLogsRateLimitData =
  typeof FellowshipLogsRateLimitDataSchema.Type;

export const FellowshipLogsRateLimitResponseDataSchema = Schema.Struct({
  rateLimitData: FellowshipLogsRateLimitDataSchema,
});

export function withRateLimitData<const Fields extends Schema.Struct.Fields>(
  fields: Fields,
) {
  return Schema.Struct({
    ...fields,
    rateLimitData: Schema.optionalKey(FellowshipLogsRateLimitDataSchema),
  });
}
