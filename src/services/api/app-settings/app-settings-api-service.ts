import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { type AppSettingsDAOError } from "@/db/daos/app-settings/app-settings-dao.ts";
import { type EncryptionError } from "@/errors/encryption-error.ts";
import {
  type AppSettingsApiAppSettings,
  type AppSettingsApiUpdate,
} from "@/services/api/app-settings/app-settings-api-schema.ts";
import { createAppSettingsApiResponse } from "@/services/api/app-settings/create-app-settings-api-response.ts";
import { AppSettings } from "@/services/app-settings/app-settings-service.ts";

export type AppSettingsApiServiceShape = {
  readonly get: () => E.Effect<AppSettingsApiAppSettings>;

  readonly set: (
    appSettings: AppSettingsApiUpdate,
  ) => E.Effect<
    AppSettingsApiAppSettings,
    AppSettingsDAOError | EncryptionError
  >;
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
    return E.gen(function* () {
      const currentAppSettings = yield* appSettingsService.get();

      const fellowshipLogsClientSecret =
        appSettings.fellowshipLogsClientSecret === undefined
          ? currentAppSettings.fellowshipLogsClientSecret
          : appSettings.fellowshipLogsClientSecret === null
            ? null
            : Redacted.make(appSettings.fellowshipLogsClientSecret);

      const updatedAppSettings = {
        fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
        fellowshipLogsClientId: appSettings.fellowshipLogsClientId,
        fellowshipLogsClientSecret,
        isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
        liveSplitHost: appSettings.liveSplitHost,
        liveSplitPort: appSettings.liveSplitPort,
      };

      yield* appSettingsService.set(updatedAppSettings);

      return createAppSettingsApiResponse(updatedAppSettings);
    });
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
