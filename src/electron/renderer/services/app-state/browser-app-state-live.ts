import * as Layer from "effect/Layer";

import * as appStateClient from "@/electron/renderer/api/electron-ipc/app-state/app-state-client.ts";
import { AppStateApiService } from "@/services/api/app-state/app-state-api-service.ts";

export const BrowserAppStateLive = Layer.succeed(AppStateApiService, {
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
