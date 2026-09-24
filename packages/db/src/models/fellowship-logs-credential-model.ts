import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { EncryptedValueEncodedSchema } from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import {
  FellowshipLogsClientIdSchema,
  SettingIdSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export class FellowshipLogsCredentialModel extends Model.Class<FellowshipLogsCredentialModel>(
  "FellowshipLogsCredentialModel",
)({
  clientId: Schema.NullOr(FellowshipLogsClientIdSchema),
  clientSecret: Schema.NullOr(EncryptedValueEncodedSchema),
  createdAt: Model.DateTimeInsertFromNumber,
  id: SettingIdSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
