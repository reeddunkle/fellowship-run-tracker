// @effect-diagnostics-next-line nodeBuiltinImport:off
import { existsSync } from "node:fs";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { app } from "electron";

/* [KEEP]
 * Loads the `.env` named by an `--env-file=<path>` launch argument (resolved
 * against the directory the app started in), if it exists. The dev scripts
 * pass the workspace `.env`; the packaged app never reads one.
 *
 * `bootstrap.ts` imports this first: modules evaluate in import order, so the
 * environment is in place before later imports read configuration while they
 * load (e.g. the app data directory).
 */

const ENV_FILE_ARGUMENT_PREFIX = "--env-file=";

const envFileArgument = process.argv
  .find((argument) => {
    return argument.startsWith(ENV_FILE_ARGUMENT_PREFIX);
  })
  ?.slice(ENV_FILE_ARGUMENT_PREFIX.length);

if (!app.isPackaged && envFileArgument !== undefined) {
  const envFilePath = path.resolve(envFileArgument);

  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}
