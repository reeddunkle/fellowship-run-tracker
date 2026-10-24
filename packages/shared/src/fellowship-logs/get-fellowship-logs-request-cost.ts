import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const NonNegativeFiniteSchema = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

const CurrentRequestSchema = Schema.Struct({
  application: NonNegativeFiniteSchema,
  total: NonNegativeFiniteSchema,
  user: Schema.optionalKey(NonNegativeFiniteSchema),
});

const decodeCurrentRequest = Schema.decodeUnknownOption(CurrentRequestSchema);

export type FellowshipLogsRequestCost = {
  readonly application: number;
  readonly total: number;
  readonly user: number;
};

export function getFellowshipLogsRequestCost(
  currentRequest: unknown,
): Option.Option<FellowshipLogsRequestCost> {
  return decodeCurrentRequest(currentRequest).pipe(
    Option.filter(({ application, total }) => {
      return application <= total;
    }),
    Option.map(({ application, total, user }) => {
      return {
        application,
        total,
        user: user ?? total - application,
      };
    }),
  );
}
