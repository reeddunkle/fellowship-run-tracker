import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AppSettings,
  type AppSettingsShape,
} from "@frt/api/services/app-settings/app-settings-service.ts";
import {
  MOCK_FELLOWSHIP_LOG_DIRECTORY,
  MOCK_LIVE_SPLIT_HOST,
  MOCK_LIVE_SPLIT_PORT,
} from "@frt/api/tests/common/fixtures/app-settings-fixtures.ts";

export type MakeAppSettingsMockOptions = Partial<AppSettingsShape>;

function makeAppSettingsMock({
  get = () => {
    return E.succeed({
      fellowshipLogDirectory: MOCK_FELLOWSHIP_LOG_DIRECTORY,
      fellowshipLogsClientId: null,
      hasFellowshipLogsClientSecret: false,
      isLiveSplitEnabled: true,
      liveSplitHost: MOCK_LIVE_SPLIT_HOST,
      liveSplitPort: MOCK_LIVE_SPLIT_PORT,
    });
  },
  set = (appSettings) => {
    return E.succeed({
      fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
      fellowshipLogsClientId: appSettings.fellowshipLogsClientId,
      hasFellowshipLogsClientSecret:
        appSettings.fellowshipLogsClientSecret !== undefined &&
        appSettings.fellowshipLogsClientSecret !== null,
      isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
      liveSplitHost: appSettings.liveSplitHost,
      liveSplitPort: appSettings.liveSplitPort,
    });
  },
}: MakeAppSettingsMockOptions = {}) {
  return Layer.succeed(AppSettings, {
    get,
    set,
  } satisfies AppSettingsShape);
}

export const AppSettingsMock = makeAppSettingsMock();
