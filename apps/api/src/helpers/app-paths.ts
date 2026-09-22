// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { getAppDataDirectory } from "@frt/api/helpers/get-app-data-directory.ts";

const appDataDirectory = getAppDataDirectory();

/**
 * Everything the app stores lives in its own directory under the app data
 * root, so nothing is written to the root itself.
 */
export const appPaths = {
  appState: path.join(appDataDirectory, "app-state"),
  databaseFile: path.join(
    appDataDirectory,
    "database",
    "fellowship-run-tracker.db",
  ),
  // Electron's `userData` directory (Chromium caches, local storage, etc.).
  electronUserData: path.join(appDataDirectory, "electron"),
  encryptionKey: path.join(appDataDirectory, "security"),
  logs: path.join(appDataDirectory, "logs"),
  root: appDataDirectory,
};
