import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { createAppSettingsApiResponse } from "@frt/api/services/app-settings/create-app-settings-api-response.ts";
import {
  AppSettingsStore,
  type AppSettingsStoreSetError,
} from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import {
  type AppSettingsApiAppSettings,
  type AppSettingsApiUpdate,
} from "@frt/shared/app-settings/app-settings-api-schema.ts";

export type AppSettingsShape = {
  readonly get: () => E.Effect<AppSettingsApiAppSettings>;

  readonly set: (
    appSettings: AppSettingsApiUpdate,
  ) => E.Effect<AppSettingsApiAppSettings, AppSettingsStoreSetError>;
};

const makeAppSettings = E.gen(function* () {
  const appSettingsStore = yield* AppSettingsStore;

  const get: AppSettingsShape["get"] = () => {
    return appSettingsStore.get().pipe(E.map(createAppSettingsApiResponse));
  };

  const set: AppSettingsShape["set"] = (appSettings) => {
    return E.gen(function* () {
      const currentAppSettings = yield* appSettingsStore.get();

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

      yield* appSettingsStore.set(updatedAppSettings);

      return createAppSettingsApiResponse(updatedAppSettings);
    });
  };

  return {
    get,
    set,
  } satisfies AppSettingsShape;
});

export class AppSettings extends Context.Service<
  AppSettings,
  AppSettingsShape
>()("@frt/api/services/app-settings/app-settings-service/AppSettings") {
  static readonly layerNoDeps = Layer.effect(this, makeAppSettings);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AppSettingsStore.layer),
  );
}
