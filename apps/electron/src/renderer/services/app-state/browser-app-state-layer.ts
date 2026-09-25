import * as Layer from "effect/Layer";

import * as appStateClient from "@/renderer/api/electron-ipc/app-state/app-state-client.ts";
import { AppState } from "@/services/app-state/app-state-service.ts";

export const BrowserAppStateLayer = Layer.succeed(AppState, {
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
