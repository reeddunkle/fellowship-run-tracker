import * as E from "effect/Effect";

import { type AppSettingsApiUpdate } from "@frt/shared/app-settings/app-settings-api-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

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
