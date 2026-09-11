import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { type AppSettingsDAOError } from "@/db/daos/app-settings/app-settings-dao.ts";
import { type AppSettingsApiAppSettings } from "@/services/api/app-settings/app-settings-api-schema.ts";
import { createAppSettingsApiResponse } from "@/services/api/app-settings/create-app-settings-api-response.ts";
import { AppSettings } from "@/services/app-settings/app-settings-service.ts";

export type AppSettingsApiServiceShape = {
  readonly get: () => E.Effect<AppSettingsApiAppSettings>;

  readonly set: (
    appSettings: AppSettingsApiAppSettings,
  ) => E.Effect<AppSettingsApiAppSettings, AppSettingsDAOError>;
};

export class AppSettingsApiService extends Context.Service<
  AppSettingsApiService,
  AppSettingsApiServiceShape
>()(
  "fellowship-run-tracker/services/api/app-settings/app-settings-api-service/AppSettingsApiService",
) {}

const make = E.gen(function* () {
  const appSettingsService = yield* AppSettings;

  const get: AppSettingsApiServiceShape["get"] = () => {
    return appSettingsService.get().pipe(E.map(createAppSettingsApiResponse));
  };

  const set: AppSettingsApiServiceShape["set"] = (appSettings) => {
    return appSettingsService
      .set(appSettings)
      .pipe(E.as(appSettings), E.map(createAppSettingsApiResponse));
  };

  return {
    get,
    set,
  } satisfies AppSettingsApiServiceShape;
});

export const AppSettingsApiServiceLive = Layer.effect(
  AppSettingsApiService,
  make,
);
