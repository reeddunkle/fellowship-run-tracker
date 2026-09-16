import * as Schema from "effect/Schema";

export const BooleanFlagSchema = Schema.Union([
  Schema.Literal("0").transform(false),
  Schema.Literal("1").transform(true),
]);

export const BooleanIntSchema = Schema.Union([
  Schema.Literal(0).transform(false),
  Schema.Literal(1).transform(true),
]);

export const EmptyStringSchema = Schema.Literal("");

export const NonEmptyStringSchema = Schema.NonEmptyString;

export type NonEmptyString = typeof NonEmptyStringSchema.Type;

export const NonNegativeNumberSchema = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
);

export const PositiveIntegerSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1),
);

export const NonNegativeIntegerSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
);

export const IntegerFromStringSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(Schema.Int),
);

export const NonNegativeNumberFromStringSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(NonNegativeNumberSchema),
);

export const PositiveIntegerFromStringSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(PositiveIntegerSchema),
);

export const JsonStringSchema = Schema.fromJsonString(Schema.String);

export const UnknownFromJsonStringSchema = Schema.fromJsonString(
  Schema.Unknown,
);

export const encodeJson = Schema.encodeEffect(UnknownFromJsonStringSchema);

export const JsonStringArraySchema = Schema.String.pipe(
  Schema.Array,
  Schema.fromJsonString,
);

export const JsonIntegerArraySchema = Schema.Int.pipe(
  Schema.Array,
  Schema.fromJsonString,
);

export const UUID7Schema = Schema.String.check(Schema.isUUID(7));

export const FilePathSchema = Schema.String.check(Schema.isMinLength(1));

export const PortSchema = Schema.Int.check(
  Schema.isBetween({ maximum: 65535, minimum: 1 }),
);

export const HostSchema = Schema.String.check(Schema.isMinLength(1));
