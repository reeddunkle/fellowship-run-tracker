import * as Schema from "effect/Schema";

import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsAuthorizedProfileSchema,
  FellowshipLogsConnectedUserNameSchema,
  FellowshipLogsConnectionGenerationSchema,
  FellowshipLogsConnectionProfileSchema,
  FellowshipLogsConnectionStatusSchema,
  FellowshipLogsPointPolicyVersionSchema,
  FellowshipLogsSpendingSchema,
  FellowshipLogsStorageProtectionSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import {
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  NonNegativeNumberSchema,
} from "@frt/shared/util/common-schemas.ts";

const RedactedStringSchema = Schema.RedactedFromValue(NonEmptyStringSchema);

export const FellowshipLogsApiConnectionSchema = Schema.Struct({
  clientId: Schema.NullOr(FellowshipLogsClientIdSchema),
  connectedUserName: Schema.NullOr(FellowshipLogsConnectedUserNameSchema),
  generation: FellowshipLogsConnectionGenerationSchema,
  pointPolicyVersion: FellowshipLogsPointPolicyVersionSchema,
  profile: FellowshipLogsConnectionProfileSchema,
  spending: FellowshipLogsSpendingSchema,
  status: FellowshipLogsConnectionStatusSchema,
  storageProtection: FellowshipLogsStorageProtectionSchema,
});

export type FellowshipLogsApiConnection =
  typeof FellowshipLogsApiConnectionSchema.Type;

const FellowshipLogsApiPointSystemOptInSchema = Schema.Literals([
  "NOT_REQUIRED",
  "OPT_IN_REQUIRED",
  "OPTED_IN",
]);

const FellowshipLogsApiAuthorizationPointSystemOptInSchema = Schema.Literals([
  ...FellowshipLogsApiPointSystemOptInSchema.literals,
  "UNCHECKED",
]);

const FellowshipLogsApiAuthorizationFailureSchema = Schema.Literals([
  "CONNECTION_CHANGED",
  "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
  "OWN_CLIENT_REJECTED",
  "PROVIDER_REJECTED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_UNEXPECTED_RESPONSE",
  "STORAGE",
]);

export type FellowshipLogsApiAuthorizationFailure =
  typeof FellowshipLogsApiAuthorizationFailureSchema.Type;

const FellowshipLogsApiAuthorizationStatusSchema = Schema.Union([
  Schema.Struct({ state: Schema.Literal("IDLE") }),
  Schema.Struct({
    expiresAtMilliseconds: NonNegativeIntegerSchema,
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literal("PENDING"),
  }),
  Schema.Struct({
    connectedUserName: FellowshipLogsConnectedUserNameSchema,
    pointSystemOptIn: FellowshipLogsApiAuthorizationPointSystemOptInSchema,
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literal("CONNECTED"),
  }),
  Schema.Struct({
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literals(["CANCELLED", "DENIED", "EXPIRED"]),
  }),
  Schema.Struct({
    failure: FellowshipLogsApiAuthorizationFailureSchema,
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literal("FAILED"),
  }),
]);

export type FellowshipLogsApiAuthorizationStatus =
  typeof FellowshipLogsApiAuthorizationStatusSchema.Type;

export const FellowshipLogsApiConnectionStatusSchema = Schema.Struct({
  authorization: FellowshipLogsApiAuthorizationStatusSchema,
  connection: Schema.NullOr(FellowshipLogsApiConnectionSchema),
});

export type FellowshipLogsApiConnectionStatus =
  typeof FellowshipLogsApiConnectionStatusSchema.Type;

const ConnectionCommandFields = {
  allowLocalFallback: Schema.Boolean,
  expectedGeneration: Schema.NullOr(FellowshipLogsConnectionGenerationSchema),
  replaceConnection: Schema.Boolean,
};

export const FellowshipLogsApiStartAuthorizationOptionsSchema = Schema.Union([
  Schema.Struct({
    ...ConnectionCommandFields,
    profile: Schema.Literal("FELLOWSHIP_RUN_TRACKER_USER"),
  }),
  Schema.Struct({
    ...ConnectionCommandFields,
    clientId: FellowshipLogsClientIdSchema,
    profile: Schema.Literal("OWN_CLIENT_USER"),
  }),
]);

export type FellowshipLogsApiStartAuthorizationOptions =
  typeof FellowshipLogsApiStartAuthorizationOptionsSchema.Type;

export const FellowshipLogsApiStartedAuthorizationSchema = Schema.Struct({
  authorizationUrl: Schema.String,
  browserLaunch: Schema.Literals(["OPENED", "LAUNCH_FAILED", "UNAVAILABLE"]),
  expiresAtMilliseconds: NonNegativeIntegerSchema,
  profile: FellowshipLogsAuthorizedProfileSchema,
  storageProtection: FellowshipLogsStorageProtectionSchema,
});

export type FellowshipLogsApiStartedAuthorization =
  typeof FellowshipLogsApiStartedAuthorizationSchema.Type;

export const FellowshipLogsApiCompleteAuthorizationOptionsSchema =
  Schema.Struct({
    callbackUrl: RedactedStringSchema,
  });

export type FellowshipLogsApiCompleteAuthorizationOptions =
  typeof FellowshipLogsApiCompleteAuthorizationOptionsSchema.Type;

export const FellowshipLogsApiCompletedAuthorizationSchema = Schema.Union([
  Schema.Struct({
    connectedUserName: FellowshipLogsConnectedUserNameSchema,
    pointSystemOptIn: FellowshipLogsApiAuthorizationPointSystemOptInSchema,
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literal("CONNECTED"),
  }),
  Schema.Struct({
    profile: FellowshipLogsAuthorizedProfileSchema,
    state: Schema.Literal("DENIED"),
  }),
]);

export type FellowshipLogsApiCompletedAuthorization =
  typeof FellowshipLogsApiCompletedAuthorizationSchema.Type;

export const FellowshipLogsApiSaveOwnClientOptionsSchema = Schema.Struct({
  ...ConnectionCommandFields,
  clientId: FellowshipLogsClientIdSchema,
  clientSecret: RedactedStringSchema,
});

export type FellowshipLogsApiSaveOwnClientOptions =
  typeof FellowshipLogsApiSaveOwnClientOptionsSchema.Type;

export const FellowshipLogsApiPointSystemOptInCheckSchema = Schema.Struct({
  result: FellowshipLogsApiPointSystemOptInSchema,
});

export type FellowshipLogsApiPointSystemOptInCheck =
  typeof FellowshipLogsApiPointSystemOptInCheckSchema.Type;

const FellowshipLogsApiPointPoolSchema = Schema.Struct({
  hasRemainingPoints: Schema.NullOr(Schema.Boolean),
  limitPerHour: Schema.NullOr(NonNegativeIntegerSchema),
  pointsRemaining: Schema.NullOr(NonNegativeNumberSchema),
  resetSource: Schema.NullOr(
    Schema.Literals(["pointsResetIn", "userPointsResetIn"]),
  ),
  resetsAtMilliseconds: Schema.NullOr(NonNegativeIntegerSchema),
});

export const FellowshipLogsApiPointPoolsSchema = Schema.NullOr(
  Schema.Struct({
    observedAtMilliseconds: NonNegativeIntegerSchema,
    pools: Schema.Struct({
      APPLICATION: FellowshipLogsApiPointPoolSchema,
      DATABASE: FellowshipLogsApiPointPoolSchema,
      USER: FellowshipLogsApiPointPoolSchema,
    }),
  }),
);

export type FellowshipLogsApiPointPools =
  typeof FellowshipLogsApiPointPoolsSchema.Type;

export const FellowshipLogsApiImportCostEstimateSchema = Schema.NullOr(
  Schema.Struct({
    latest: Schema.NullOr(
      Schema.Struct({
        applicationPoints: NonNegativeNumberSchema,
        completedAtMilliseconds: NonNegativeIntegerSchema,
        isFullyCached: Schema.Boolean,
        totalPoints: NonNegativeNumberSchema,
        userPoints: NonNegativeNumberSchema,
      }),
    ),
    range: Schema.NullOr(
      Schema.Struct({
        highPoints: NonNegativeNumberSchema,
        lowPoints: NonNegativeNumberSchema,
        sampleCount: NonNegativeIntegerSchema,
      }),
    ),
  }),
);

export type FellowshipLogsApiImportCostEstimate =
  typeof FellowshipLogsApiImportCostEstimateSchema.Type;
