// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "effect/Effect";
import { app, BrowserWindow } from "electron";

import { configureWindowIpc } from "@/electron/application/configure-window-ipc.ts";
import { getAppStateStorageDirectory } from "@/electron/storage/app-state/get-app-state-storage-directory.ts";
import { env } from "@/env.ts";
import { makeElectronRuntime } from "@/runtimes/electron-runtime.ts";

import { createWindow } from "./application/create-window.ts";
import { runElectronApplication } from "./application/run-electron-application.ts";
import { shutdownElectronApplication } from "./application/shutdown-electron-application.ts";

const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

const useRendererDevServer =
  !app.isPackaged && process.argv.includes("--renderer-dev-server");

const rendererDevServerUrl = useRendererDevServer
  ? `http://${env.electronRenderer.host}:${env.electronRenderer.port}`
  : undefined;

let isShuttingDown = false;

const windowOptions = {
  currentDirectoryPath,
  rendererDevServerUrl,
};

void app.whenReady().then(() => {
  const electronRuntime = makeElectronRuntime({
    appStateStorageDirectory: getAppStateStorageDirectory(),
    databaseFilename: env.databaseFilename,
  });

  configureWindowIpc(electronRuntime);

  electronRuntime.runFork(
    runElectronApplication(windowOptions).pipe(
      E.catch((error) => {
        return E.gen(function* () {
          yield* E.logError("Electron application failed.", {
            error,
          });

          yield* E.sync(() => {
            app.quit();
          });
        });
      }),
    ),
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void electronRuntime.runPromise(createWindow(windowOptions));
    }
  });

  app.on("before-quit", (event) => {
    if (isShuttingDown) {
      return;
    }

    event.preventDefault();
    isShuttingDown = true;

    void E.runPromise(
      shutdownElectronApplication({
        runtime: electronRuntime,
      }),
    ).finally(() => {
      app.quit();
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
