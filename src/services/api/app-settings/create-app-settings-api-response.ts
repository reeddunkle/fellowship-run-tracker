import { type AppSettingsApiAppSettings } from "@/services/api/app-settings/app-settings-api-schema.ts";
import { type AppSettingsValue } from "@/services/app-settings/app-settings-service.ts";

export function createAppSettingsApiResponse(
  appSettings: AppSettingsValue,
): AppSettingsApiAppSettings {
  return {
    fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
    isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
    liveSplitsHost: appSettings.liveSplitsHost,
    liveSplitsPort: appSettings.liveSplitsPort,
  };
}
