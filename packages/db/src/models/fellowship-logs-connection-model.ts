import * as Schema from "effect/Schema";
import * as Model from "effect/schema/Model";

import { ProtectedValueEncodedSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
  FellowshipLogsConnectionGenerationSchema,
  FellowshipLogsConnectionProfileSchema,
  FellowshipLogsPointPolicyVersionSchema,
  FellowshipLogsStorageProtectionSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export class FellowshipLogsConnectionModel extends Model.Class<FellowshipLogsConnectionModel>(
  "FellowshipLogsConnectionModel",
)({
  accessToken: Schema.NullOr(ProtectedValueEncodedSchema),
  accessTokenExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  clientId: FellowshipLogsClientIdSchema,
  clientSecret: Schema.NullOr(ProtectedValueEncodedSchema),
  connectedUserId: Schema.NullOr(FellowshipLogsConnectedUserIdSchema),
  connectedUserName: Schema.NullOr(FellowshipLogsConnectedUserNameSchema),
  createdAt: Model.DateTimeInsertFromNumber,
  generation: FellowshipLogsConnectionGenerationSchema,
  id: Schema.Literal(1),
  localProtectionAcknowledgedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  pointPolicyVersion: FellowshipLogsPointPolicyVersionSchema,
  pointSystemOptInRequiredAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  profile: FellowshipLogsConnectionProfileSchema,
  refreshToken: Schema.NullOr(ProtectedValueEncodedSchema),
  storageProtection: FellowshipLogsStorageProtectionSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
