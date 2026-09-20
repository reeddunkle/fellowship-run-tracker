import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";
import {
  AppStateStorage,
  type AppStateStorageShape,
} from "@/electron/storage/app-state/app-state-storage.ts";
import { AppStateApiService } from "@/services/api/app-state/app-state-api-service.ts";
import { AppStateApiServiceLive } from "@/services/api/app-state/app-state-api-service-live.ts";
import { runTest } from "@/tests/common/run-test.ts";

const electron = vi.hoisted(() => {
  return { nativeTheme: { themeSource: "dark" } };
});

vi.mock("electron", () => electron);

function makeStorage(
  setTheme: AppStateStorageShape["setTheme"],
): AppStateStorageShape {
  return {
    getDungeonRunComparisonGroup: E.succeed(
      DEFAULT_APP_STATE.dungeonRun.comparisonGroup,
    ),
    getDungeonRunTimeColumns: E.succeed(
      DEFAULT_APP_STATE.dungeonRun.timeColumns,
    ),
    getSelectedConfigurationId: E.succeed(
      DEFAULT_APP_STATE.selectedConfigurationId,
    ),
    getSidebarOpen: E.succeed(DEFAULT_APP_STATE.sidebarOpen),
    getTheme: E.succeed(DEFAULT_APP_STATE.theme),
    setDungeonRunComparisonGroup: () => E.void,
    setDungeonRunTimeColumns: () => E.void,
    setSelectedConfigurationId: () => E.void,
    setSidebarOpen: () => E.void,
    setTheme,
  };
}

function runWithStorage(
  setTheme: AppStateStorageShape["setTheme"],
): Promise<void> {
  const StorageLive = Layer.succeed(AppStateStorage, makeStorage(setTheme));
  const ApiLive = AppStateApiServiceLive.pipe(Layer.provide(StorageLive));
  const program = AppStateApiService.use((service) => {
    return service.setTheme("light");
  }).pipe(E.provide(ApiLive));

  return runTest(program);
}

describe("AppStateApiServiceLive", () => {
  beforeEach(() => {
    electron.nativeTheme.themeSource = "dark";
  });

  test("applies the supplied theme after persistence succeeds", async () => {
    await runWithStorage(() => E.void);

    expect(electron.nativeTheme.themeSource).toBe("light");
  });

  test("does not apply the theme when persistence fails", async () => {
    const result = runWithStorage(() => {
      return E.fail(
        new KeyValueStore.KeyValueStoreError({
          key: "app-state",
          message: "Write failed",
          method: "set",
        }),
      );
    });

    await expect(result).rejects.toBeInstanceOf(
      KeyValueStore.KeyValueStoreError,
    );
    expect(electron.nativeTheme.themeSource).toBe("dark");
  });
});
