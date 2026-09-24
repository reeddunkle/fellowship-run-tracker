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
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { appConfig } from "@frt/api/app-config.ts";
import { type EncryptionError } from "@frt/api/errors/encryption-error.ts";
import { Encryption } from "@frt/api/services/encryption/encryption-service.ts";
import {
  AppSettingDAO,
  type AppSettingDAOError,
} from "@frt/db/daos/app-setting/app-setting-dao.ts";
import {
  FellowshipLogsCredentialDAO,
  type FellowshipLogsCredentialDAOError,
} from "@frt/db/daos/fellowship-logs-credential/fellowship-logs-credential-dao.ts";
import {
  LiveSplitSettingDAO,
  type LiveSplitSettingDAOError,
} from "@frt/db/daos/live-split-setting/live-split-setting-dao.ts";
import {
  type FellowshipLogDirectory,
  type FellowshipLogsClientId,
  type FellowshipLogsClientSecret,
  FellowshipLogsClientSecretSchema,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export type AppSettingsValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly fellowshipLogsClientId: FellowshipLogsClientId | null;
  readonly fellowshipLogsClientSecret: Redacted.Redacted<FellowshipLogsClientSecret> | null;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitHost: LiveSplitHost;
  readonly liveSplitPort: LiveSplitPort;
};

export type AppSettingsSetError =
  | AppSettingDAOError
  | EncryptionError
  | FellowshipLogsCredentialDAOError
  | LiveSplitSettingDAOError
  | SqlError.SqlError;

export type AppSettingsShape = {
  readonly get: () => E.Effect<AppSettingsValue>;

  readonly set: (
    appSettings: AppSettingsValue,
  ) => E.Effect<void, AppSettingsSetError>;

  readonly streamChanges: () => Stream.Stream<AppSettingsValue>;
};

const makeAppSettings = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const appSettingDAO = yield* AppSettingDAO;
  const encryption = yield* Encryption;
  const fellowshipLogsCredentialDAO = yield* FellowshipLogsCredentialDAO;
  const liveSplitSettingDAO = yield* LiveSplitSettingDAO;

  const decryptClientSecret = E.fn("AppSettings.decryptClientSecret")(
    function* (ciphertext: string) {
      const decryptedClientSecret = yield* encryption.decrypt(ciphertext);

      const decodedClientSecret = yield* pipe(
        Redacted.value(decryptedClientSecret),
        Schema.decodeEffect(FellowshipLogsClientSecretSchema),
      );

      return Redacted.make(decodedClientSecret);
    },
  );

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

  const loadFellowshipLogsCredential = E.gen(function* () {
    const persisted = yield* fellowshipLogsCredentialDAO.get();

    if (Option.isSome(persisted)) {
      const encryptedClientSecret = persisted.value.clientSecret;

      const clientSecret =
        encryptedClientSecret === null
          ? null
          : yield* decryptClientSecret(encryptedClientSecret).pipe(
              E.catch((cause) => {
                return E.logWarning(
                  "Failed to decrypt the stored Fellowship Logs client secret; treating it as not configured.",
                  {
                    cause,
                  },
                ).pipe(E.as(null));
              }),
            );

      return { clientId: persisted.value.clientId, clientSecret };
    }

    const clientId = Option.getOrNull(yield* appConfig.fellowshipLogsClientId);

    const clientSecret = Option.map(
      yield* appConfig.fellowshipLogsClientSecret,
      Redacted.make,
    ).pipe(Option.getOrNull);

    yield* fellowshipLogsCredentialDAO.insert({
      clientId,
      clientSecret:
        clientSecret === null ? null : yield* encryption.encrypt(clientSecret),
    });

    return { clientId, clientSecret };
  });

  const initialAppSettings = yield* sql.withTransaction(
    E.gen(function* () {
      const appSetting = yield* loadAppSetting;
      const liveSplitSetting = yield* loadLiveSplitSetting;
      const credential = yield* loadFellowshipLogsCredential;

      return {
        fellowshipLogDirectory: appSetting.fellowshipLogDirectory,
        fellowshipLogsClientId: credential.clientId,
        fellowshipLogsClientSecret: credential.clientSecret,
        isLiveSplitEnabled: liveSplitSetting.isEnabled,
        liveSplitHost: liveSplitSetting.host,
        liveSplitPort: liveSplitSetting.port,
      } satisfies AppSettingsValue;
    }),
  );

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

            yield* fellowshipLogsCredentialDAO.update({
              clientId: appSettings.fellowshipLogsClientId,
              clientSecret: encryptedClientSecret,
            });
          }),
        );

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
>()("@frt/api/services/app-settings/app-settings-service/AppSettings") {
  static readonly layerNoDeps = Layer.effect(this, makeAppSettings);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(AppSettingDAO.layer),
    Layer.provide(FellowshipLogsCredentialDAO.layer),
    Layer.provide(LiveSplitSettingDAO.layer),
    Layer.provide(Encryption.layer),
  );
}
