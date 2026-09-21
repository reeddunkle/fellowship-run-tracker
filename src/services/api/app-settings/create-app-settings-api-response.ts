import { type AppSettingsApiAppSettings } from "@/contracts/app-settings/app-settings-api-schema.ts";
import { type AppSettingsValue } from "@/services/app-settings/app-settings-service.ts";

export function createAppSettingsApiResponse(
  appSettings: AppSettingsValue,
): AppSettingsApiAppSettings {
  return {
    fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
    fellowshipLogsClientId: appSettings.fellowshipLogsClientId,
    hasFellowshipLogsClientSecret:
      appSettings.fellowshipLogsClientSecret !== null,
    isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
    liveSplitHost: appSettings.liveSplitHost,
    liveSplitPort: appSettings.liveSplitPort,
  };
}
