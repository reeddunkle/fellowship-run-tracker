// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { app } from "electron";

export function getAppStateStorageDirectory() {
  return path.join(app.getPath("userData"), "app-state");
}
