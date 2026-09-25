import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  AppSettingsStore,
  type AppSettingsValue,
} from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { Encryption } from "@frt/api/services/encryption/encryption-service.ts";
import { makeEncryptionHarness } from "@frt/api/tests/common/harnesses/encryption-harness.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  FellowshipLogDirectorySchema,
  FellowshipLogsClientIdSchema,
  FellowshipLogsClientSecretSchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/app-settings/app-settings-schema.ts";

const UPDATED_SETTINGS = {
  fellowshipLogDirectory: Schema.decodeSync(FellowshipLogDirectorySchema)(
    "C:/Logs",
  ),
  fellowshipLogsClientId: Schema.decodeSync(FellowshipLogsClientIdSchema)(
    "test-client-id",
  ),
  fellowshipLogsClientSecret: Redacted.make(
    Schema.decodeSync(FellowshipLogsClientSecretSchema)("test-client-secret"),
  ),
  isLiveSplitEnabled: true,
  liveSplitHost: Schema.decodeSync(LiveSplitHostSchema)("192.168.1.20"),
  liveSplitPort: Schema.decodeSync(LiveSplitPortSchema)(16835),
} satisfies AppSettingsValue;

/** Settings with the secret revealed, so they can be compared. */
function reveal(settings: AppSettingsValue) {
  return {
    ...settings,
    fellowshipLogsClientSecret:
      settings.fellowshipLogsClientSecret === null
        ? null
        : Redacted.value(settings.fellowshipLogsClientSecret),
  };
}

function withAppSettingsStore<A, Error>(
  program: E.Effect<A, Error, AppSettingsStore | MainDatabase>,
) {
  return E.scoped(
    E.gen(function* () {
      const { encryption } = yield* makeEncryptionHarness();

      const PersistenceTestLive = makePersistenceTestLayer();

      const AppSettingsStoreTestLive = AppSettingsStore.layerNoDeps.pipe(
        Layer.provide(
          Layer.merge(
            PersistenceTestLive,
            Layer.succeed(Encryption, encryption),
          ),
        ),
      );

      return yield* program.pipe(
        E.provide(Layer.merge(PersistenceTestLive, AppSettingsStoreTestLive)),
      );
    }),
  ).pipe(E.provide(NodePlatformLayer));
}

const countSettingRows = E.gen(function* () {
  const sql = yield* MainDatabase;

  const [row] = yield* sql<{
    readonly appSetting: number;
    readonly fellowshipLogsCredential: number;
    readonly liveSplitSetting: number;
  }>`
    SELECT
      (
        SELECT
          COUNT(*)
        FROM
          app_setting
      ) AS app_setting,
      (
        SELECT
          COUNT(*)
        FROM
          live_split_setting
      ) AS live_split_setting,
      (
        SELECT
          COUNT(*)
        FROM
          fellowship_logs_credential
      ) AS fellowship_logs_credential
  `;

  return row;
});

describe("AppSettingsStore", () => {
  test("seeds one row in each settings table", async () => {
    const counts = await withAppSettingsStore(
      E.gen(function* () {
        yield* AppSettingsStore;

        return yield* countSettingRows;
      }),
    ).pipe(runTest);

    expect(counts).toEqual({
      appSetting: 1,
      fellowshipLogsCredential: 1,
      liveSplitSetting: 1,
    });
  });

  test("saves settings across all three tables, encrypting the secret", async () => {
    const { current, storedSecret } = await withAppSettingsStore(
      E.gen(function* () {
        const appSettingsStore = yield* AppSettingsStore;
        const sql = yield* MainDatabase;

        yield* appSettingsStore.set(UPDATED_SETTINGS);

        const [credential] = yield* sql<{ readonly clientSecret: string }>`
          SELECT
            client_secret
          FROM
            fellowship_logs_credential
        `;

        return {
          current: yield* appSettingsStore.get(),
          storedSecret: credential?.clientSecret,
        };
      }),
    ).pipe(runTest);

    expect(reveal(current)).toEqual(reveal(UPDATED_SETTINGS));
    expect(storedSecret).toEqual(expect.any(String));
    expect(storedSecret).not.toContain("test-client-secret");
  });

  test("changes nothing when saving one of the tables fails", async () => {
    const { current, directory, error } = await withAppSettingsStore(
      E.gen(function* () {
        const appSettingsStore = yield* AppSettingsStore;
        const sql = yield* MainDatabase;

        const before = yield* appSettingsStore.get();

        // Written last, so the other two tables have already been updated
        // inside the transaction when this fails.
        yield* sql`DROP TABLE fellowship_logs_credential`;

        const setError = yield* appSettingsStore
          .set(UPDATED_SETTINGS)
          .pipe(E.flip);

        const [row] = yield* sql<{ readonly fellowshipLogDirectory: string }>`
          SELECT
            fellowship_log_directory
          FROM
            app_setting
        `;

        return {
          current: { after: yield* appSettingsStore.get(), before },
          directory: {
            after: row?.fellowshipLogDirectory,
            before: before.fellowshipLogDirectory,
          },
          error: setError,
        };
      }),
    ).pipe(runTest);

    expect(error._tag).toBe("SqlError");
    expect(directory.after).toBe(directory.before);
    expect(reveal(current.after)).toEqual(reveal(current.before));
  });
});
