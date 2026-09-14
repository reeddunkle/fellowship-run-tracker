import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import type * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { appConfig } from "@/app-config.ts";
import {
  AppSettingsDAO,
  type AppSettingsDAOError,
} from "@/db/daos/app-settings/app-settings-dao.ts";
import { type AppSettingsModel } from "@/db/models/app-settings-model.ts";
import {
  type FellowshipLogDirectory,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@/validation/app-settings/app-settings-schema.ts";

export type AppSettingsValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitsHost: LiveSplitHost;
  readonly liveSplitsPort: LiveSplitPort;
};

export type AppSettingsShape = {
  readonly get: () => E.Effect<AppSettingsValue>;

  readonly set: (
    appSettings: AppSettingsValue,
  ) => E.Effect<void, AppSettingsDAOError>;

  readonly streamChanges: () => Stream.Stream<AppSettingsValue>;
};

export class AppSettings extends Context.Service<
  AppSettings,
  AppSettingsShape
>()(
  "fellowship-run-tracker/services/app-settings/app-settings-service/AppSettings",
) {}

function toAppSettingsValue(appSettings: AppSettingsModel): AppSettingsValue {
  return {
    fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
    isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
    liveSplitsHost: appSettings.liveSplitsHost,
    liveSplitsPort: appSettings.liveSplitsPort,
  };
}

const makeAppSettings = E.gen(function* () {
  const appSettingsDAO = yield* AppSettingsDAO;

  const fellowshipLogDirectory = yield* appConfig.fellowshipLogDirectory;

  const liveSplitsHost = yield* appConfig.liveSplitsHost;

  const liveSplitsPort = yield* appConfig.liveSplitsPort;

  const persistedAppSettings = yield* appSettingsDAO.get();

  const initialAppSettings = yield* Option.match(persistedAppSettings, {
    onNone: () => {
      const appSettings = {
        fellowshipLogDirectory,
        isLiveSplitEnabled: false,
        liveSplitsHost,
        liveSplitsPort,
      } satisfies AppSettingsValue;

      return E.as(appSettingsDAO.insert(appSettings), appSettings);
    },
    onSome: (appSettings) => {
      return E.succeed(toAppSettingsValue(appSettings));
    },
  });

  const appSettingsRef =
    yield* SubscriptionRef.make<AppSettingsValue>(initialAppSettings);

  const semaphore = yield* Semaphore.make(1);

  const set: AppSettingsShape["set"] = (appSettings) => {
    return semaphore.withPermits(1)(
      E.gen(function* () {
        yield* appSettingsDAO.update(appSettings);

        yield* SubscriptionRef.set(appSettingsRef, appSettings);
      }),
    );
  };

  return {
    get: () => SubscriptionRef.get(appSettingsRef),
    set,
    streamChanges: () => SubscriptionRef.changes(appSettingsRef),
  } satisfies AppSettingsShape;
});

export const AppSettingsLive = Layer.effect(AppSettings, makeAppSettings);
