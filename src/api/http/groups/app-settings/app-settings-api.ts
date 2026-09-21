import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  AppSettingsApiAppSettingsSchema,
  AppSettingsApiUpdateSchema,
} from "@/contracts/app-settings/app-settings-api-schema.ts";

const APP_SETTINGS_ROUTE = "/app-settings" as const;

const GetAppSettingsEndpoint = HttpApiEndpoint.get(
  "getAppSettings",
  APP_SETTINGS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: AppSettingsApiAppSettingsSchema,
  },
);

const PutAppSettingsEndpoint = HttpApiEndpoint.put(
  "putAppSettings",
  APP_SETTINGS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    payload: AppSettingsApiUpdateSchema,
    success: AppSettingsApiAppSettingsSchema,
  },
);

export const AppSettingsApi = HttpApiGroup.make("appSettings").add(
  GetAppSettingsEndpoint,
  PutAppSettingsEndpoint,
);
