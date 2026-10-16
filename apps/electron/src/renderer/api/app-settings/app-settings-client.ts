import * as E from "effect/Effect";

import { type AppSettingsApiUpdate } from "@frt/shared/app-settings/app-settings-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export const getAppSettings = E.fn("AppSettingsApiClient.getAppSettings")(
  function* () {
    const client = yield* AppApiClient;

    return yield* client.appSettings.getAppSettings();
  },
);

export const putAppSettings = E.fn("AppSettingsApiClient.putAppSettings")(
  function* (appSettings: AppSettingsApiUpdate) {
    const client = yield* AppApiClient;

    return yield* client.appSettings.putAppSettings({
      payload: appSettings,
    });
  },
);
