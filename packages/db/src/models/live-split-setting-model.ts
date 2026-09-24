import * as Model from "effect/unstable/schema/Model";

import {
  IsLiveSplitEnabledSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
  SettingIdSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export class LiveSplitSettingModel extends Model.Class<LiveSplitSettingModel>(
  "LiveSplitSettingModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  host: LiveSplitHostSchema,
  id: SettingIdSchema,
  isEnabled: IsLiveSplitEnabledSchema,
  port: LiveSplitPortSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
