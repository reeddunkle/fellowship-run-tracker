import * as Layer from "effect/Layer";

import { AppStateApiService } from "@/contracts/app-state/app-state-api-service.ts";
import * as appStateClient from "@/electron/renderer/api/electron-ipc/app-state/app-state-client.ts";

export const BrowserAppStateLayer = Layer.succeed(AppStateApiService, {
  getDungeonRunComparisonGroup: appStateClient.getDungeonRunComparisonGroup,
  getDungeonRunTimeColumns: appStateClient.getDungeonRunTimeColumns,
  getSelectedConfigurationId: appStateClient.getSelectedConfigurationId,
  getSidebarOpen: appStateClient.getSidebarOpen,
  getTheme: appStateClient.getTheme,
  setDungeonRunComparisonGroup: appStateClient.setDungeonRunComparisonGroup,
  setDungeonRunTimeColumns: appStateClient.setDungeonRunTimeColumns,
  setSelectedConfigurationId: appStateClient.setSelectedConfigurationId,
  setSidebarOpen: appStateClient.setSidebarOpen,
  setTheme: appStateClient.setTheme,
});
