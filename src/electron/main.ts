// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "effect/Effect";
import type * as Path from "effect/Path";
import { app, BrowserWindow } from "electron";

import { appConfig } from "@/app-config.ts";
import { configureWindowIpc } from "@/electron/application/configure-window-ipc.ts";
import { getAppStateStorageDirectory } from "@/helpers/get-app-state-storage-directory.ts";
import { getDatabaseFilename } from "@/helpers/get-database-filename.ts";
import { getEncryptionKeyDirectory } from "@/helpers/get-encryption-key-directory.ts";
import { NodePathLive } from "@/layers/node-platform-layer.ts";
import { logCause } from "@/logging/log-cause.ts";
import { makeElectronRuntime } from "@/runtimes/electron-runtime.ts";
import { type AppStateService } from "@/services/app-state/app-state-service.ts";

import { createWindow } from "./application/create-window.ts";
import { runElectronApplication } from "./application/run-electron-application.ts";
import { shutdownElectronApplication } from "./application/shutdown-electron-application.ts";

const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

function runElectronMain() {
  return E.gen(function* () {
    const electronRendererHost = yield* appConfig.electronRendererHost;
    const electronRendererPort = yield* appConfig.electronRendererPort;

    yield* E.promise(() => app.whenReady());

    const databaseFilename = yield* getDatabaseFilename();
    const appStateStorageDirectory = getAppStateStorageDirectory();
    const encryptionKeyDirectory = getEncryptionKeyDirectory();

    const electronRuntime = makeElectronRuntime({
      appStateStorageDirectory,
      databaseFilename,
      encryptionKeyDirectory,
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

    function runProgram<A, ProgramError>(
      effect: E.Effect<A, ProgramError, Path.Path | AppStateService>,
    ) {
      void electronRuntime.runPromiseExit(effect.pipe(E.tapCause(logCause)));
    }

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

void E.runPromiseExit(
  runElectronMain().pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    E.provide(NodePathLive),
    E.tapCause(logCause),
  ),
);
