import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayGraphQLVariablesSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
);

export const FellowshipLogsGatewayGraphQLRequestSchema = Schema.Struct({
  query: NonEmptyStringSchema,
  variables: FellowshipLogsGatewayGraphQLVariablesSchema.pipe(
    Schema.optionalKey,
  ),
});

export type FellowshipLogsGatewayGraphQLRequest =
  typeof FellowshipLogsGatewayGraphQLRequestSchema.Type;

const FellowshipLogsGatewayGraphQLErrorLocationSchema = Schema.Struct({
  column: Schema.Int,
  line: Schema.Int,
});

const FellowshipLogsGatewayGraphQLErrorPathSegmentSchema = Schema.Union([
  Schema.String,
  Schema.Int,
]);

const FellowshipLogsGatewayGraphQLErrorSchema = Schema.Struct({
  extensions: Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.optionalKey,
  ),
  locations: FellowshipLogsGatewayGraphQLErrorLocationSchema.pipe(
    Schema.Array,
    Schema.optionalKey,
  ),
  message: NonEmptyStringSchema,
  path: FellowshipLogsGatewayGraphQLErrorPathSegmentSchema.pipe(
    Schema.Array,
    Schema.optionalKey,
  ),
});

export type FellowshipLogsGatewayGraphQLError =
  typeof FellowshipLogsGatewayGraphQLErrorSchema.Type;

export function makeFellowshipLogsGatewayGraphQLResponseSchema<Data>(
  dataSchema: Schema.Decoder<Data, never>,
) {
  return Schema.Struct({
    data: dataSchema.pipe(Schema.NullOr, Schema.optionalKey),
    errors: FellowshipLogsGatewayGraphQLErrorSchema.pipe(
      Schema.Array,
      Schema.optionalKey,
    ),
  });
}

export type FellowshipLogsGatewayGraphQLResponse<Data> = Schema.Schema.Type<
  ReturnType<typeof makeFellowshipLogsGatewayGraphQLResponseSchema<Data>>
>;
