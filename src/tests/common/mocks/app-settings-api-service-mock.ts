import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  AppSettingsApiService,
  type AppSettingsApiServiceShape,
} from "@/services/api/app-settings/app-settings-api-service.ts";
import {
  MOCK_FELLOWSHIP_LOG_DIRECTORY,
  MOCK_LIVE_SPLIT_HOST,
  MOCK_LIVE_SPLIT_PORT,
} from "@/tests/common/fixtures/app-settings-fixtures.ts";

export type MakeAppSettingsApiServiceMockOptions =
  Partial<AppSettingsApiServiceShape>;

function makeAppSettingsApiServiceMock({
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
}: MakeAppSettingsApiServiceMockOptions = {}) {
  return Layer.succeed(AppSettingsApiService, {
    get,
    set,
  } satisfies AppSettingsApiServiceShape);
}

export const AppSettingsApiServiceMock = makeAppSettingsApiServiceMock();
