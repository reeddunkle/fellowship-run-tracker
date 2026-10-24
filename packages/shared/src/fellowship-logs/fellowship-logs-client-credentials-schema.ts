import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export const FellowshipLogsClientIdSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsClientId"),
);

export type FellowshipLogsClientId = typeof FellowshipLogsClientIdSchema.Type;

export const FellowshipLogsClientSecretSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsClientSecret"),
);
