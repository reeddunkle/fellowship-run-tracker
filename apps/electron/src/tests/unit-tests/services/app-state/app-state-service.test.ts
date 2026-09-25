import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { runTest } from "@frt/api/tests/common/run-test.ts";
import { DEFAULT_APP_STATE } from "@frt/shared/app-state/app-state-schema.ts";

import { AppState } from "@/services/app-state/app-state-service.ts";
import { AppStateLayerNoDeps } from "@/services/app-state/app-state-service-layer.ts";
import {
  AppStateStore,
  type AppStateStoreShape,
} from "@/services/app-state-store/app-state-store-service.ts";

const electron = vi.hoisted(() => {
  return { nativeTheme: { themeSource: "dark" } };
});

vi.mock("electron", () => electron);

function makeStore(
  setTheme: AppStateStoreShape["setTheme"],
): AppStateStoreShape {
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

function runWithStore(setTheme: AppStateStoreShape["setTheme"]): Promise<void> {
  const StoreLive = Layer.succeed(AppStateStore, makeStore(setTheme));
  const ApiLive = AppStateLayerNoDeps.pipe(Layer.provide(StoreLive));
  const program = AppState.use((service) => {
    return service.setTheme("light");
  }).pipe(E.provide(ApiLive));

  return runTest(program);
}

describe("AppState", () => {
  beforeEach(() => {
    electron.nativeTheme.themeSource = "dark";
  });

  test("applies the supplied theme after persistence succeeds", async () => {
    await runWithStore(() => E.void);

    expect(electron.nativeTheme.themeSource).toBe("light");
  });

  test("does not apply the theme when persistence fails", async () => {
    const result = runWithStore(() => {
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
