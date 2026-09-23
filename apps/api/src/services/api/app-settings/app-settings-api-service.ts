import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { type EncryptionError } from "@frt/api/errors/encryption-error.ts";
import { createAppSettingsApiResponse } from "@frt/api/services/api/app-settings/create-app-settings-api-response.ts";
import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import { type AppSettingsDAOError } from "@frt/db/daos/app-settings/app-settings-dao.ts";
import {
  type AppSettingsApiAppSettings,
  type AppSettingsApiUpdate,
} from "@frt/shared/app-settings/app-settings-api-schema.ts";

export type AppSettingsApiServiceShape = {
  readonly get: () => E.Effect<AppSettingsApiAppSettings>;

  readonly set: (
    appSettings: AppSettingsApiUpdate,
  ) => E.Effect<
    AppSettingsApiAppSettings,
    AppSettingsDAOError | EncryptionError
  >;
};

const makeAppSettingsApiService = E.gen(function* () {
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

export class AppSettingsApiService extends Context.Service<
  AppSettingsApiService,
  AppSettingsApiServiceShape
>()(
  "@frt/api/services/api/app-settings/app-settings-api-service/AppSettingsApiService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeAppSettingsApiService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AppSettings.layer),
  );
}
