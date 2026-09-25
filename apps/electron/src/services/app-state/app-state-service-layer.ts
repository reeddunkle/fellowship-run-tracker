import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import {
  AppState,
  type AppStateShape,
} from "@/services/app-state/app-state-service.ts";
import { AppStateStorage } from "@/storage/app-state/app-state-storage.ts";
import { makeAppStateStorageLayer } from "@/storage/app-state/app-state-storage-layer.ts";

const makeAppState = E.gen(function* () {
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
  } satisfies AppStateShape;
});

export const AppStateLayerNoDeps = Layer.effect(AppState, makeAppState);

export function makeAppStateLayer(directoryPath: string) {
  return AppStateLayerNoDeps.pipe(
    Layer.provide(makeAppStateStorageLayer(directoryPath)),
  );
}
