import { type AppSettingsValue } from "@frt/api/services/app-settings/app-settings-service.ts";
import { type AppSettingsApiAppSettings } from "@frt/shared/app-settings/app-settings-api-schema.ts";

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
