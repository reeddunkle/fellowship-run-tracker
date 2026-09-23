// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import envPaths from "env-paths";

import { isPackagedElectronApp } from "@frt/api/helpers/is-packaged-electron-app.ts";

const APP_NAME = "fellowship-run-tracker";

const DEVELOPMENT_APP_NAME = "fellowship-run-tracker-dev";

function getUserDataDirectory(appName: string) {
  return envPaths(appName, {
    suffix: "",
  }).data;
}

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

export function getRelativePathBaseDirectory() {
  return isPackagedElectronApp() ? getAppDataDirectory() : process.cwd();
}
