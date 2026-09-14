import * as Model from "effect/unstable/schema/Model";

import {
  AppSettingsIdSchema,
  FellowshipLogDirectorySchema,
  IsLiveSplitEnabledSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";

export class AppSettingsModel extends Model.Class<AppSettingsModel>(
  "AppSettingsModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  id: AppSettingsIdSchema,
  isLiveSplitEnabled: IsLiveSplitEnabledSchema,
  liveSplitsHost: LiveSplitHostSchema,
  liveSplitsPort: LiveSplitPortSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
