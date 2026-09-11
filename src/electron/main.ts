// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "effect/Effect";
import type * as Path from "effect/Path";
import { app, BrowserWindow } from "electron";

import { appConfig } from "@/app-config.ts";
import { configureWindowIpc } from "@/electron/application/configure-window-ipc.ts";
import { type AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { getAppStateStorageDirectory } from "@/electron/storage/app-state/get-app-state-storage-directory.ts";
import { logCause } from "@/logging/log-cause.ts";
import { makeElectronRuntime } from "@/runtimes/electron-runtime.ts";

import { createWindow } from "./application/create-window.ts";
import { runElectronApplication } from "./application/run-electron-application.ts";
import { shutdownElectronApplication } from "./application/shutdown-electron-application.ts";

const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

function runElectronMain() {
  return E.gen(function* () {
    const databaseFilename = yield* appConfig.databaseFilename;
    const electronRendererHost = yield* appConfig.electronRendererHost;
    const electronRendererPort = yield* appConfig.electronRendererPort;

    yield* E.promise(() => app.whenReady());

    const electronRuntime = makeElectronRuntime({
      appStateStorageDirectory: getAppStateStorageDirectory(),
      databaseFilename,
    });

    const useRendererDevServer =
      !app.isPackaged && process.argv.includes("--renderer-dev-server");

    const rendererDevServerUrl = useRendererDevServer
      ? `http://${electronRendererHost}:${electronRendererPort}`
      : undefined;

    const windowOptions = {
      currentDirectoryPath,
      rendererDevServerUrl,
    };

    const runProgram = <A, ProgramError>(
      effect: E.Effect<A, ProgramError, Path.Path | AppStateStorage>,
    ) => {
      electronRuntime.runFork(
        effect.pipe(
          E.catchCause((cause) => {
            return logCause(cause);
          }),
        ),
      );
    };

    configureWindowIpc(electronRuntime);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        runProgram(createWindow(windowOptions));
      }
    });

    app.once("before-quit", (event) => {
      event.preventDefault();

      runProgram(
        shutdownElectronApplication({
          runtime: electronRuntime,
        }).pipe(
          E.ensuring(
            E.sync(() => {
              app.quit();
            }),
          ),
        ),
      );
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    runProgram(runElectronApplication(windowOptions));
  });
}

E.runFork(
  runElectronMain().pipe(
    E.catchCause((cause) => {
      return logCause(cause);
    }),
  ),
);
