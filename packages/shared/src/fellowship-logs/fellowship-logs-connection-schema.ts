import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

export const FELLOWSHIP_LOGS_POINT_POLICY_VERSION = "2026-10-20-beta";

export const FellowshipLogsConnectionProfileSchema = Schema.Literals([
  "FELLOWSHIP_RUN_TRACKER_USER",
  "OWN_CLIENT",
  "OWN_CLIENT_USER",
]);

export type FellowshipLogsConnectionProfile =
  typeof FellowshipLogsConnectionProfileSchema.Type;

export const FellowshipLogsAuthorizedProfileSchema = Schema.Literals([
  "FELLOWSHIP_RUN_TRACKER_USER",
  "OWN_CLIENT_USER",
]);

export type FellowshipLogsAuthorizedProfile =
  typeof FellowshipLogsAuthorizedProfileSchema.Type;

export const FellowshipLogsConnectionStatusSchema = Schema.Literals([
  "CONNECTED",
  "POINT_SYSTEM_OPT_IN_REQUIRED",
  "REAUTHORIZATION_REQUIRED",
]);

export type FellowshipLogsConnectionStatus =
  typeof FellowshipLogsConnectionStatusSchema.Type;

export const FellowshipLogsSpendingSchema = Schema.Literals([
  "DEFAULT",
  "USER_POINTS_ONLY",
]);

export type FellowshipLogsSpending = typeof FellowshipLogsSpendingSchema.Type;

export const FellowshipLogsPointPolicyVersionSchema = Schema.Literal(
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
);

export type FellowshipLogsPointPolicyVersion =
  typeof FellowshipLogsPointPolicyVersionSchema.Type;

export const FellowshipLogsStorageProtectionSchema = Schema.Literals([
  "OS_BACKED",
  "LOCAL_KEY",
]);

export type FellowshipLogsStorageProtection =
  typeof FellowshipLogsStorageProtectionSchema.Type;

export const FellowshipLogsConnectionGenerationSchema = Schema.String.check(
  Schema.isUUID(4),
).pipe(Schema.brand("FellowshipLogsConnectionGeneration"));

export type FellowshipLogsConnectionGeneration =
  typeof FellowshipLogsConnectionGenerationSchema.Type;

export const FellowshipLogsConnectedUserIdSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsConnectedUserId"),
);

export type FellowshipLogsConnectedUserId =
  typeof FellowshipLogsConnectedUserIdSchema.Type;

export const FellowshipLogsConnectedUserNameSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsConnectedUserName"),
);

export type FellowshipLogsConnectedUserName =
  typeof FellowshipLogsConnectedUserNameSchema.Type;

export const FellowshipLogsOAuthStateSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsOAuthState"),
);

export type FellowshipLogsOAuthState =
  typeof FellowshipLogsOAuthStateSchema.Type;

export const FellowshipLogsRedirectUriSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsRedirectUri"),
);

export type FellowshipLogsRedirectUri =
  typeof FellowshipLogsRedirectUriSchema.Type;
