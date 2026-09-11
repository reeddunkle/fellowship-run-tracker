import * as Schema from "effect/Schema";

import {
  FellowshipLogDirectorySchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";

export const AppSettingsApiAppSettingsSchema = Schema.Struct({
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  liveSplitsHost: LiveSplitHostSchema,
  liveSplitsPort: LiveSplitPortSchema,
});

export type AppSettingsApiAppSettings =
  typeof AppSettingsApiAppSettingsSchema.Type;
