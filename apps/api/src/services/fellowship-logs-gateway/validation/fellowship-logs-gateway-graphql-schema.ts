import type * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FellowshipLogsGatewayAccessError,
  type FellowshipLogsGatewayPointPolicyError,
  type FellowshipLogsGatewayRateLimitRejectedError,
  type FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { type FellowshipLogsGatewayQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayGraphQLVariablesSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
);

export const FellowshipLogsGatewayGraphQLWireRequestSchema = Schema.Struct({
  query: NonEmptyStringSchema,
  variables: FellowshipLogsGatewayGraphQLVariablesSchema.pipe(
    Schema.optionalKey,
  ),
});

export type FellowshipLogsGatewayGraphQLRequest = {
  readonly query: FellowshipLogsGatewayQuery;
  readonly variables?: typeof FellowshipLogsGatewayGraphQLVariablesSchema.Type;
};

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

export type Query = <ResponseData>(
  request: FellowshipLogsGatewayGraphQLRequest,
  responseSchema: Schema.Decoder<ResponseData, never>,
) => E.Effect<
  FellowshipLogsGatewayGraphQLResponse<ResponseData>,
  FellowshipLogsGatewayQueryError
>;

export type FellowshipLogsGatewayQueryError =
  | FellowshipLogsGatewayAccessError
  | FellowshipLogsGatewayPointPolicyError
  | FellowshipLogsGatewayRateLimitRejectedError
  | FellowshipLogsGatewayRequestError;
