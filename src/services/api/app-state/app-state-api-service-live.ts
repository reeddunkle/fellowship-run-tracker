import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";

import { AppStateApiService } from "./app-state-api-service.ts";

export const AppStateApiServiceLive = Layer.effect(
  AppStateApiService,
  E.gen(function* () {
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
    };
  }),
);
