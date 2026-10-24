import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  AppSettingsStore,
  type AppSettingsValue,
} from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { makePersistenceTestLayer } from "@frt/api/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  FellowshipLogDirectorySchema,
  LiveSplitHostSchema,
  LiveSplitPortSchema,
} from "@frt/shared/app-settings/app-settings-schema.ts";

const UPDATED_SETTINGS = {
  fellowshipLogDirectory: Schema.decodeSync(FellowshipLogDirectorySchema)(
    "C:/Logs",
  ),
  isLiveSplitEnabled: true,
  liveSplitHost: Schema.decodeSync(LiveSplitHostSchema)("192.168.1.20"),
  liveSplitPort: Schema.decodeSync(LiveSplitPortSchema)(16835),
} satisfies AppSettingsValue;

function withAppSettingsStore<A, Error>(
  program: E.Effect<A, Error, AppSettingsStore | MainDatabase>,
) {
  return E.scoped(
    E.gen(function* () {
      const PersistenceTestLive = makePersistenceTestLayer();

      const AppSettingsStoreTestLive = AppSettingsStore.layerNoDeps.pipe(
        Layer.provide(PersistenceTestLive),
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
      ) AS live_split_setting
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
      liveSplitSetting: 1,
    });
  });

  test("saves settings across both tables", async () => {
    const current = await withAppSettingsStore(
      E.gen(function* () {
        const appSettingsStore = yield* AppSettingsStore;

        yield* appSettingsStore.set(UPDATED_SETTINGS);

        return yield* appSettingsStore.get();
      }),
    ).pipe(runTest);

    expect(current).toEqual(UPDATED_SETTINGS);
  });

  test("changes nothing when saving one of the tables fails", async () => {
    const { current, directory, error } = await withAppSettingsStore(
      E.gen(function* () {
        const appSettingsStore = yield* AppSettingsStore;
        const sql = yield* MainDatabase;

        const before = yield* appSettingsStore.get();

        // [AI] Written last, so the other table has already been updated
        // inside the transaction when this fails.
        yield* sql`DROP TABLE live_split_setting`;

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
    expect(current.after).toEqual(current.before);
  });
});
