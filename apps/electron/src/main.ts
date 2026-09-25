// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as E from "effect/Effect";
import type * as Exit from "effect/Exit";
import type * as Path from "effect/Path";
import { app, BrowserWindow } from "electron";

import { appConfig } from "@frt/api/app-config.ts";
import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { logCause } from "@frt/api/logging/log-cause.ts";

import { configureErrorLogging } from "@/application/configure-error-logging.ts";
import { configureWebContentsSecurity } from "@/application/configure-web-contents-security.ts";
import { configureWindowIpc } from "@/application/configure-window-ipc.ts";
import { configureDetachedWindowPlacement } from "@/application/detached-window/configure-detached-window-placement.ts";
import { exitOnStartupFailure } from "@/application/exit-on-startup-failure.ts";
import { flushWindowStateSavesForQuit } from "@/application/window-state-tracking.ts";
import { electronRuntime } from "@/runtimes/electron-runtime.ts";
import { type AppState } from "@/services/app-state/app-state-service.ts";
import { type WindowState } from "@/services/window-state/window-state-service.ts";

import { createWindow } from "./application/create-window.ts";
import { runElectronApplication } from "./application/run-electron-application.ts";

const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

app.setPath("userData", appPaths.electronUserData);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

function disposeElectronRuntime() {
  return electronRuntime.dispose().catch(() => {
    return undefined;
  });
}

function exitOnFailure<A, Error>(exit: Exit.Exit<A, Error>) {
  return exitOnStartupFailure(exit, { flushLogs: disposeElectronRuntime });
}

function runProgram<A, ProgramError>(
  effect: E.Effect<A, ProgramError, Path.Path | AppState | WindowState>,
) {
  return electronRuntime.runPromiseExit(effect.pipe(E.tapCause(logCause)));
}

function runElectronMain() {
  return E.gen(function* () {
    const electronRendererHost = yield* appConfig.electronRendererHost;
    const electronRendererPort = yield* appConfig.electronRendererPort;

    const useRendererDevServer =
      !app.isPackaged && process.argv.includes("--renderer-dev-server");

    const rendererDevServerUrl = useRendererDevServer
      ? `http://${electronRendererHost}:${electronRendererPort}`
      : undefined;

    const windowOptions = {
      currentDirectoryPath,
      rendererDevServerUrl,
    };

    const appBaseUrl =
      rendererDevServerUrl ??
      `${pathToFileURL(path.join(currentDirectoryPath, "renderer")).href}/`;

    configureErrorLogging(electronRuntime);
    configureWebContentsSecurity({
      appBaseUrl,
      preloadPath: path.join(currentDirectoryPath, "preload.cjs"),
    });
    configureWindowIpc(electronRuntime);
    yield* configureDetachedWindowPlacement();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void runProgram(createWindow(windowOptions));
      }
    });

    app.once("before-quit", (event) => {
      event.preventDefault();

      void flushWindowStateSavesForQuit()
        .then(disposeElectronRuntime)
        .finally(() => {
          app.quit();
        });
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    void runProgram(runElectronApplication(windowOptions)).then(exitOnFailure);
  });
}

if (hasSingleInstanceLock) {
  void runProgram(runElectronMain()).then(exitOnFailure);
} else {
  app.quit();
}
