import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";
import { type AppSettingsApiAppSettings } from "@/services/api/app-settings/app-settings-api-schema.ts";

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

export function getAppSettingsBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.appSettings.getAppSettings();
    });
  };
}

export function putAppSettingsBase(baseUrl: string) {
  return (appSettings: AppSettingsApiAppSettings) => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.appSettings.putAppSettings({
        payload: appSettings,
      });
    });
  };
}

export function getAppSettings() {
  return getAppSettingsBase(getApiBaseUrl())();
}

export function putAppSettings(appSettings: AppSettingsApiAppSettings) {
  return putAppSettingsBase(getApiBaseUrl())(appSettings);
}
