// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { getAppDataDirectory } from "@frt/api/helpers/get-app-data-directory.ts";

const appDataDirectory = getAppDataDirectory();

export const appPaths = {
  appState: path.join(appDataDirectory, "app-state"),
  databaseFile: path.join(
    appDataDirectory,
    "database",
    "fellowship-run-tracker.db",
  ),
  electronUserData: path.join(appDataDirectory, "electron"),
  encryptionKey: path.join(appDataDirectory, "security"),
  fellowshipLogsCacheDatabaseFile: path.join(
    appDataDirectory,
    "database",
    "fellowship-logs-cache.db",
  ),
  logs: path.join(appDataDirectory, "logs"),
  root: appDataDirectory,
  stateDatabaseFile: path.join(appDataDirectory, "database", "state.db"),
};
