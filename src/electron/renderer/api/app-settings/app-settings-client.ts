import * as E from "effect/Effect";

import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";
import { type AppSettingsApiUpdate } from "@/services/api/app-settings/app-settings-api-schema.ts";

export function getAppSettings() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.appSettings.getAppSettings();
  });
}

export function putAppSettings(appSettings: AppSettingsApiUpdate) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.appSettings.putAppSettings({
      payload: appSettings,
    });
  });
}
