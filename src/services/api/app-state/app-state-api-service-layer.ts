import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import {
  AppStateApiService,
  type AppStateApiServiceShape,
} from "@/contracts/app-state/app-state-api-service.ts";
import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { makeAppStateStorageLayer } from "@/electron/storage/app-state/app-state-storage-layer.ts";

const makeAppStateApiService = E.gen(function* () {
  const storage = yield* AppStateStorage;

  return {
    getDungeonRunComparisonGroup: storage.getDungeonRunComparisonGroup,
    getDungeonRunTimeColumns: storage.getDungeonRunTimeColumns,
    getSelectedConfigurationId: storage.getSelectedConfigurationId,
    getSidebarOpen: storage.getSidebarOpen,
    getTheme: storage.getTheme,
    setDungeonRunComparisonGroup: (comparisonGroup) =>
      storage.setDungeonRunComparisonGroup(comparisonGroup),
    setDungeonRunTimeColumns: (timeColumns) =>
      storage.setDungeonRunTimeColumns(timeColumns),
    setSelectedConfigurationId: (selectedConfigurationId) =>
      storage.setSelectedConfigurationId(selectedConfigurationId),
    setSidebarOpen: (sidebarOpen) => storage.setSidebarOpen(sidebarOpen),
    setTheme: (theme) =>
      storage.setTheme(theme).pipe(
        E.tap(() =>
          E.sync(() => {
            nativeTheme.themeSource = theme;
          }),
        ),
        E.asVoid,
      ),
  } satisfies AppStateApiServiceShape;
});

export const AppStateApiServiceLayerNoDeps = Layer.effect(
  AppStateApiService,
  makeAppStateApiService,
);

export function makeAppStateApiServiceLayer(directoryPath: string) {
  return AppStateApiServiceLayerNoDeps.pipe(
    Layer.provide(makeAppStateStorageLayer(directoryPath)),
  );
}
