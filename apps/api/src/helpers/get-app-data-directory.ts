// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import envPaths from "env-paths";

import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";

const APP_NAME = "fellowship-run-tracker";

// Unpackaged runs that aren't given an `APP_DATA_DIRECTORY` (e.g. the stock
// Electron binary running a built `app.asar` copied outside the repo) keep
// their data apart from the packaged app's.
const DEVELOPMENT_APP_NAME = "fellowship-run-tracker-dev";

function getUserDataDirectory(appName: string) {
  return envPaths(appName, {
    suffix: "",
  }).data;
}

/**
 * - Packaged app: the OS user data directory (e.g. `%LOCALAPPDATA%` on
 *   Windows).
 * - Unpackaged runs: `APP_DATA_DIRECTORY` when set (relative paths resolve
 *   against the directory the process started in), otherwise a separate OS
 *   user data directory for development.
 *
 * Read synchronously when modules load, so whatever launches the process has
 * to provide it up front (see `.env.example`).
 */
export function getAppDataDirectory() {
  if (isPackagedElectronApp()) {
    return getUserDataDirectory(APP_NAME);
  }

  // Read while modules load, before any Effect runtime (and `Config`) exists.
  // @effect-diagnostics-next-line processEnv:off
  const appDataDirectory = process.env.APP_DATA_DIRECTORY;

  return appDataDirectory === undefined || appDataDirectory === ""
    ? getUserDataDirectory(DEVELOPMENT_APP_NAME)
    : path.resolve(appDataDirectory);
}

/**
 * Relative paths from configuration (e.g. `DATABASE_FILENAME`) resolve against
 * the app data directory in the packaged app, and against the directory the
 * process started in otherwise.
 */
export function getRelativePathBaseDirectory() {
  return isPackagedElectronApp() ? getAppDataDirectory() : process.cwd();
}
