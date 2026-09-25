import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import {
  AppState,
  type AppStateShape,
} from "@/services/app-state/app-state-service.ts";
import { AppStateStore } from "@/services/app-state-store/app-state-store-service.ts";

const makeAppState = E.gen(function* () {
  const store = yield* AppStateStore;

  return {
    getDungeonRunComparisonGroup: store.getDungeonRunComparisonGroup,
    getDungeonRunTimeColumns: store.getDungeonRunTimeColumns,
    getSelectedConfigurationId: store.getSelectedConfigurationId,
    getSidebarOpen: store.getSidebarOpen,
    getTheme: store.getTheme,
    setDungeonRunComparisonGroup: (comparisonGroup) =>
      store.setDungeonRunComparisonGroup(comparisonGroup),
    setDungeonRunTimeColumns: (timeColumns) =>
      store.setDungeonRunTimeColumns(timeColumns),
    setSelectedConfigurationId: (selectedConfigurationId) =>
      store.setSelectedConfigurationId(selectedConfigurationId),
    setSidebarOpen: (sidebarOpen) => store.setSidebarOpen(sidebarOpen),
    setTheme: (theme) =>
      store.setTheme(theme).pipe(
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
    Layer.provide(AppStateStore.layerWith(directoryPath)),
  );
}
