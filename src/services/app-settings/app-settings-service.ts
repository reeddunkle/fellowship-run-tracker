import * as Context from "effect/Context";
import * as E from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import type * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { appConfig } from "@/app-config.ts";
import {
  AppSettingsDAO,
  type AppSettingsDAOError,
} from "@/db/daos/app-settings/app-settings-dao.ts";
import { type EncryptionError } from "@/errors/encryption-error.ts";
import { Encryption } from "@/services/encryption/encryption-service.ts";
import {
  type FellowshipLogDirectory,
  type FellowshipLogsClientId,
  type FellowshipLogsClientSecret,
  FellowshipLogsClientSecretSchema,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@/validation/app-settings/app-settings-schema.ts";

export type AppSettingsValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly fellowshipLogsClientId: FellowshipLogsClientId | null;
  readonly fellowshipLogsClientSecret: Redacted.Redacted<FellowshipLogsClientSecret> | null;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitHost: LiveSplitHost;
  readonly liveSplitPort: LiveSplitPort;
};

export type AppSettingsShape = {
  readonly get: () => E.Effect<AppSettingsValue>;

  readonly set: (
    appSettings: AppSettingsValue,
  ) => E.Effect<void, AppSettingsDAOError | EncryptionError>;

  readonly streamChanges: () => Stream.Stream<AppSettingsValue>;
};

const makeAppSettings = E.gen(function* () {
  const appSettingsDAO = yield* AppSettingsDAO;
  const encryption = yield* Encryption;

  const fellowshipLogDirectory = yield* appConfig.fellowshipLogDirectory;
  const fellowshipLogsClientId = yield* appConfig.fellowshipLogsClientId;
  const fellowshipLogsClientSecret =
    yield* appConfig.fellowshipLogsClientSecret;
  const liveSplitHost = yield* appConfig.liveSplitHost;
  const liveSplitPort = yield* appConfig.liveSplitPort;

  const persistedAppSettings = yield* appSettingsDAO.get();

  const initialAppSettings = yield* Option.match(persistedAppSettings, {
    onNone: () => {
      return E.gen(function* () {
        const clientId = Option.getOrNull(fellowshipLogsClientId);

        const clientSecret = Option.map(
          fellowshipLogsClientSecret,
          Redacted.make,
        ).pipe(Option.getOrNull);

        const encryptedClientSecret =
          clientSecret === null
            ? null
            : yield* encryption.encrypt(clientSecret);

        const appSettings = {
          fellowshipLogDirectory,
          fellowshipLogsClientId: clientId,
          fellowshipLogsClientSecret: clientSecret,
          isLiveSplitEnabled: false,
          liveSplitHost,
          liveSplitPort,
        } satisfies AppSettingsValue;

        yield* appSettingsDAO.insert({
          fellowshipLogDirectory,
          fellowshipLogsClientId: clientId,
          fellowshipLogsClientSecret: encryptedClientSecret,
          isLiveSplitEnabled: false,
          liveSplitHost,
          liveSplitPort,
        });

        return appSettings;
      });
    },
    onSome: (appSettings) => {
      return E.gen(function* () {
        const decryptClientSecret = E.fn("AppSettings.decryptClientSecret")(
          function* (encryptedClientSecret: string) {
            const decryptedClientSecret = yield* encryption.decrypt(
              encryptedClientSecret,
            );

            const clientSecret = yield* pipe(
              Redacted.value(decryptedClientSecret),
              Schema.decodeEffect(FellowshipLogsClientSecretSchema),
            );

            return Redacted.make(clientSecret);
          },
        );

        const encryptedClientSecret = appSettings.fellowshipLogsClientSecret;

        const fellowshipLogsClientSecret =
          encryptedClientSecret === null
            ? null
            : yield* decryptClientSecret(encryptedClientSecret);

        return {
          fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
          fellowshipLogsClientId: appSettings.fellowshipLogsClientId,
          fellowshipLogsClientSecret,
          isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
          liveSplitHost: appSettings.liveSplitHost,
          liveSplitPort: appSettings.liveSplitPort,
        } satisfies AppSettingsValue;
      });
    },
  });

  const appSettingsRef =
    yield* SubscriptionRef.make<AppSettingsValue>(initialAppSettings);

  const semaphore = yield* Semaphore.make(1);

  const set: AppSettingsShape["set"] = (appSettings) => {
    return semaphore.withPermits(1)(
      E.gen(function* () {
        const encryptedClientSecret =
          appSettings.fellowshipLogsClientSecret === null
            ? null
            : yield* encryption.encrypt(appSettings.fellowshipLogsClientSecret);

        yield* appSettingsDAO.update({
          fellowshipLogDirectory: appSettings.fellowshipLogDirectory,
          fellowshipLogsClientId: appSettings.fellowshipLogsClientId,
          fellowshipLogsClientSecret: encryptedClientSecret,
          isLiveSplitEnabled: appSettings.isLiveSplitEnabled,
          liveSplitHost: appSettings.liveSplitHost,
          liveSplitPort: appSettings.liveSplitPort,
        });

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

export class AppSettings extends Context.Service<
  AppSettings,
  AppSettingsShape
>()(
  "fellowship-run-tracker/services/app-settings/app-settings-service/AppSettings",
) {
  static readonly layerNoDeps = Layer.effect(this, makeAppSettings);

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(AppSettingsDAO.layer),
      Layer.provide(Encryption.layerWith(options)),
    );
  };
}
