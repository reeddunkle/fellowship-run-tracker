import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/validation/common-schemas.ts";

const FellowshipLogsGraphQLVariablesSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
);

export const FellowshipLogsGraphQLRequestSchema = Schema.Struct({
  query: NonEmptyStringSchema,
  variables: FellowshipLogsGraphQLVariablesSchema.pipe(Schema.optionalKey),
});

export type FellowshipLogsGraphQLRequest =
  typeof FellowshipLogsGraphQLRequestSchema.Type;

const FellowshipLogsGraphQLErrorLocationSchema = Schema.Struct({
  column: Schema.Int,
  line: Schema.Int,
});

const FellowshipLogsGraphQLErrorPathSegmentSchema = Schema.Union([
  Schema.String,
  Schema.Int,
]);

const FellowshipLogsGraphQLErrorSchema = Schema.Struct({
  extensions: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.optionalKey,
  ),
  locations: FellowshipLogsGraphQLErrorLocationSchema.pipe(
    Schema.Array,
    Schema.optionalKey,
  ),
  message: NonEmptyStringSchema,
  path: FellowshipLogsGraphQLErrorPathSegmentSchema.pipe(
    Schema.Array,
    Schema.optionalKey,
  ),
});

export type FellowshipLogsGraphQLError =
  typeof FellowshipLogsGraphQLErrorSchema.Type;

export function makeFellowshipLogsGraphQLResponseSchema<Data>(
  dataSchema: Schema.Decoder<Data, never>,
) {
  return Schema.Struct({
    data: dataSchema.pipe(Schema.NullOr, Schema.optionalKey),
    errors: FellowshipLogsGraphQLErrorSchema.pipe(
      Schema.Array,
      Schema.optionalKey,
    ),
  });
}

export type FellowshipLogsGraphQLResponse<Data> = Schema.Schema.Type<
  ReturnType<typeof makeFellowshipLogsGraphQLResponseSchema<Data>>
>;
