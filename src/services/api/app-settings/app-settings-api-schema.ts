import * as Schema from "effect/Schema";

import {
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  FellowshipLogsClientSecretSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@/validation/app-settings/app-settings-schema.ts";

export const AppSettingsApiAppSettingsSchema = Schema.Struct({
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  fellowshipLogsClientId: Schema.NullOr(FellowshipLogsClientIdSchema),
  hasFellowshipLogsClientSecret: Schema.Boolean,
  isLiveSplitEnabled: Schema.Boolean,
  liveSplitHost: LiveSplitHostSchema,
  liveSplitPort: LiveSplitPortSchema,
});

export type AppSettingsApiAppSettings =
  typeof AppSettingsApiAppSettingsSchema.Type;

export const AppSettingsApiUpdateSchema = Schema.Struct({
  fellowshipLogDirectory: FellowshipLogDirectorySchema,
  fellowshipLogsClientId: Schema.NullOr(FellowshipLogsClientIdSchema),
  fellowshipLogsClientSecret: FellowshipLogsClientSecretSchema.pipe(
    Schema.NullOr,
    Schema.optionalKey,
  ),
  isLiveSplitEnabled: Schema.Boolean,
  liveSplitHost: LiveSplitHostSchema,
  liveSplitPort: LiveSplitPortSchema,
});

export type AppSettingsApiUpdate = typeof AppSettingsApiUpdateSchema.Type;
