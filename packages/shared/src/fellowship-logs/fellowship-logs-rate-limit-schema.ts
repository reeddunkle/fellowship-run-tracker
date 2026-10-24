import * as Schema from "effect/Schema";

import {
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const NonNegativeFiniteSchema = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

const FellowshipLogsApplicationRateLimitFields = {
  limitPerHour: PositiveIntegerSchema,
  pointsResetIn: NonNegativeIntegerSchema,
  pointsSpentThisHour: NonNegativeFiniteSchema,
};

const FellowshipLogsRateLimitDataSchema = Schema.Struct({
  ...FellowshipLogsApplicationRateLimitFields,
  currentRequest: Schema.optionalKey(Schema.Unknown),
  databaseLimitPerHour: Schema.optionalKey(NonNegativeIntegerSchema),
  databasePointsSpentThisHour: Schema.optionalKey(NonNegativeFiniteSchema),
  userHasRemainingPoints: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  userPointsResetIn: Schema.optionalKey(
    Schema.NullOr(NonNegativeIntegerSchema),
  ),
});

export type FellowshipLogsRateLimitData =
  typeof FellowshipLogsRateLimitDataSchema.Type;

/** [KEEP]
 * Rate-limit data plus when it was observed. `pointsResetIn` is relative to
 * `observedAtMilliseconds`, so the data can't be interpreted later without it.
 */
const FellowshipLogsRateLimitSnapshotSchema = Schema.Struct({
  ...FellowshipLogsRateLimitDataSchema.fields,
  observedAtMilliseconds: NonNegativeIntegerSchema,
});

export type FellowshipLogsRateLimitSnapshot =
  typeof FellowshipLogsRateLimitSnapshotSchema.Type;

export const FellowshipLogsApplicationRateLimitSnapshotSchema = Schema.Struct({
  ...FellowshipLogsApplicationRateLimitFields,
  observedAtMilliseconds: NonNegativeIntegerSchema,
});

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
