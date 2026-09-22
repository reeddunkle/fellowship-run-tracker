import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { EncryptedValueEncodedSchema } from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import {
  AppSettingsIdSchema,
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  IsLiveSplitEnabledSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export class AppSettingsModel extends Model.Class<AppSettingsModel>(
  "AppSettingsModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  fellowshipLogsClientId: Schema.NullOr(FellowshipLogsClientIdSchema),
  fellowshipLogsClientSecret: Schema.NullOr(EncryptedValueEncodedSchema),
  id: AppSettingsIdSchema,
  isLiveSplitEnabled: IsLiveSplitEnabledSchema,
  liveSplitHost: LiveSplitHostSchema,
  liveSplitPort: LiveSplitPortSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
