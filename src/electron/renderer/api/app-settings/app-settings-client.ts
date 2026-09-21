import * as E from "effect/Effect";

import { type AppSettingsApiUpdate } from "@/contracts/app-settings/app-settings-api-schema.ts";
import { AppApiClient } from "@/electron/renderer/services/app-api-client/app-api-client";

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
