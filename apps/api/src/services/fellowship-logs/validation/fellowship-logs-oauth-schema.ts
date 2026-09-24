import * as Schema from "effect/Schema";

import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsAccessTokenSchema =
  Schema.RedactedFromValue(NonEmptyStringSchema);

export type FellowshipLogsAccessToken =
  typeof FellowshipLogsAccessTokenSchema.Type;

export const FellowshipLogsOAuthTokenResponseSchema = Schema.Struct({
  access_token: FellowshipLogsAccessTokenSchema,
  expires_in: PositiveIntegerSchema,
  token_type: NonEmptyStringSchema,
});
