import * as Schema from "effect/Schema";

import {
  BooleanIntSchema,
  HostSchema,
  NonEmptyStringSchema,
  PortSchema,
} from "@frt/shared/validation/common-schemas.ts";

export const AppSettingsIdSchema = Schema.Literal(1).pipe(
  Schema.brand("AppSettingsId"),
);

export const LiveSplitHostSchema = HostSchema.pipe(
  Schema.brand("LiveSplitHost"),
);

export type LiveSplitHost = typeof LiveSplitHostSchema.Type;

export const LiveSplitPortSchema = PortSchema.pipe(
  Schema.brand("LiveSplitPort"),
);

export type LiveSplitPort = typeof LiveSplitPortSchema.Type;

export const IsLiveSplitEnabledSchema = BooleanIntSchema;

export const FellowshipLogDirectorySchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogDirectory"),
);

export type FellowshipLogDirectory = typeof FellowshipLogDirectorySchema.Type;

export const FellowshipLogsClientIdSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsClientId"),
);

export type FellowshipLogsClientId = typeof FellowshipLogsClientIdSchema.Type;

export const FellowshipLogsClientSecretSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsClientSecret"),
);

export type FellowshipLogsClientSecret =
  typeof FellowshipLogsClientSecretSchema.Type;
