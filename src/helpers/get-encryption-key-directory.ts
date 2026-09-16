// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { app } from "electron";

export function getEncryptionKeyDirectory() {
  return path.join(app.getPath("userData"), "security");
}
