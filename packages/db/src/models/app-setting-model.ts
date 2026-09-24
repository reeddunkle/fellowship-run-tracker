import * as Model from "effect/unstable/schema/Model";

import {
  FellowshipLogDirectorySchema,
  SettingIdSchema,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export class AppSettingModel extends Model.Class<AppSettingModel>(
  "AppSettingModel",
)({
  createdAt: Model.DateTimeInsertFromNumber,
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  id: SettingIdSchema,
  updatedAt: Model.DateTimeUpdateFromNumber,
}) {}
