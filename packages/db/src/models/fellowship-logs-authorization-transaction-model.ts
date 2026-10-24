import * as Schema from "effect/Schema";
import * as Model from "effect/schema/Model";

import { ProtectedValueEncodedSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsAuthorizedProfileSchema,
  FellowshipLogsConnectionGenerationSchema,
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export class FellowshipLogsAuthorizationTransactionModel extends Model.Class<FellowshipLogsAuthorizationTransactionModel>(
  "FellowshipLogsAuthorizationTransactionModel",
)({
  clientId: FellowshipLogsClientIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  expectedGeneration: Schema.NullOr(FellowshipLogsConnectionGenerationSchema),
  expiresAt: Schema.DateTimeUtcFromMillis,
  id: Schema.Literal(1),
  profile: FellowshipLogsAuthorizedProfileSchema,
  protectedVerifier: ProtectedValueEncodedSchema,
  redirectUri: FellowshipLogsRedirectUriSchema,
  state: FellowshipLogsOAuthStateSchema,
}) {}
