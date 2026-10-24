import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import type * as SqlError from "effect/sql/SqlError";

import { appConfig } from "@frt/api/app-config.ts";
import {
  AppSettingDAO,
  type AppSettingDAOError,
} from "@frt/db/daos/app-setting/app-setting-dao.ts";
import {
  LiveSplitSettingDAO,
  type LiveSplitSettingDAOError,
} from "@frt/db/daos/live-split-setting/live-split-setting-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  type FellowshipLogDirectory,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@frt/shared/app-settings/app-settings-schema.ts";

export type AppSettingsValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitHost: LiveSplitHost;
  readonly liveSplitPort: LiveSplitPort;
};

export type AppSettingsStoreSetError =
  | AppSettingDAOError
  | LiveSplitSettingDAOError
  | SqlError.SqlError;

export type AppSettingsStoreShape = {
  readonly get: () => E.Effect<AppSettingsValue>;

  readonly set: (
    appSettings: AppSettingsValue,
  ) => E.Effect<void, AppSettingsStoreSetError>;
};

const makeAppSettingsStore = E.gen(function* () {
  const sql = yield* MainDatabase;
  const appSettingDAO = yield* AppSettingDAO;
  const liveSplitSettingDAO = yield* LiveSplitSettingDAO;

  const loadAppSetting = E.gen(function* () {
    const persisted = yield* appSettingDAO.get();

    if (Option.isSome(persisted)) {
      return {
        fellowshipLogDirectory: persisted.value.fellowshipLogDirectory,
      };
    }

    const appSetting = {
      fellowshipLogDirectory: yield* appConfig.fellowshipLogDirectory,
    };

    yield* appSettingDAO.insert(appSetting);

    return appSetting;
  });

  const loadLiveSplitSetting = E.gen(function* () {
    const persisted = yield* liveSplitSettingDAO.get();

    if (Option.isSome(persisted)) {
      return persisted.value;
    }

    const liveSplitSetting = {
      host: yield* appConfig.liveSplitHost,
      isEnabled: false,
      port: yield* appConfig.liveSplitPort,
    };

    yield* liveSplitSettingDAO.insert(liveSplitSetting);

    return liveSplitSetting;
  });

  const initialAppSettings = yield* sql.withTransaction(
    E.gen(function* () {
      const appSetting = yield* loadAppSetting;
      const liveSplitSetting = yield* loadLiveSplitSetting;

      return {
        fellowshipLogDirectory: appSetting.fellowshipLogDirectory,
        isLiveSplitEnabled: liveSplitSetting.isEnabled,
        liveSplitHost: liveSplitSetting.host,
        liveSplitPort: liveSplitSetting.port,
      } satisfies AppSettingsValue;
    }),
  );

  const appSettingsRef = yield* Ref.make<AppSettingsValue>(initialAppSettings);

  const semaphore = yield* Semaphore.make(1);

  const set: AppSettingsStoreShape["set"] = E.fn("AppSettingsStore.set")(
    function* (appSettings) {
      yield* sql.withTransaction(
        E.gen(function* () {
          yield* appSettingDAO.update({
            fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
          });

          yield* liveSplitSettingDAO.update({
            host: appSettings.liveSplitHost,
            isEnabled: appSettings.isLiveSplitEnabled,
            port: appSettings.liveSplitPort,
          });
        }),
      );

      yield* Ref.set(appSettingsRef, appSettings);
    },
    semaphore.withPermits(1),
  );

  return {
    get: () => Ref.get(appSettingsRef),
    set,
  } satisfies AppSettingsStoreShape;
});

export class AppSettingsStore extends Context.Service<
  AppSettingsStore,
  AppSettingsStoreShape
>()(
  "@frt/api/services/app-settings-store/app-settings-store-service/AppSettingsStore",
) {
  static readonly layerNoDeps = Layer.effect(this, makeAppSettingsStore);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AppSettingDAO.layer),
    Layer.provide(LiveSplitSettingDAO.layer),
  );
}
