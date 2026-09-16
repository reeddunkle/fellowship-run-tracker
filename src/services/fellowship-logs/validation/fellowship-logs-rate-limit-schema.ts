import * as Schema from "effect/Schema";

import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@/validation/common-schemas.ts";

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

/**
 * Fellowship Logs lets every query request `rateLimitData` as a sibling of
 * its "real" selection. This mixes that optional field into a response data
 * schema so a query's response can be decoded and, opportunistically, yield
 * the caller's latest rate limit standing alongside its actual data.
 */
export function withRateLimitData<const Fields extends Schema.Struct.Fields>(
  fields: Fields,
) {
  return Schema.Struct({
    ...fields,
    rateLimitData: Schema.optionalKey(FellowshipLogsRateLimitDataSchema),
  });
}
