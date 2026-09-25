import * as Schema from "effect/Schema";

import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsGatewayAccessTokenSchema =
  Schema.RedactedFromValue(NonEmptyStringSchema);

export type FellowshipLogsGatewayAccessToken =
  typeof FellowshipLogsGatewayAccessTokenSchema.Type;

export const FellowshipLogsGatewayOAuthTokenResponseSchema = Schema.Struct({
  access_token: FellowshipLogsGatewayAccessTokenSchema,
  expires_in: PositiveIntegerSchema,
  token_type: NonEmptyStringSchema,
});
