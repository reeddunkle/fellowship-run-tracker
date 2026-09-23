// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as E from "effect/Effect";
import type * as Exit from "effect/Exit";
import type * as Path from "effect/Path";
import { app, BrowserWindow } from "electron";

import { appConfig } from "@frt/api/app-config.ts";
import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { getDatabaseFilename } from "@frt/api/helpers/get-database-filename.ts";
import { logCause } from "@frt/api/logging/log-cause.ts";

import { configureErrorLogging } from "@/application/configure-error-logging.ts";
import { configureWebContentsSecurity } from "@/application/configure-web-contents-security.ts";
import { configureWindowIpc } from "@/application/configure-window-ipc.ts";
import { exitOnStartupFailure } from "@/application/exit-on-startup-failure.ts";
import { makeElectronRuntime } from "@/runtimes/electron-runtime.ts";
import { startupRuntime } from "@/runtimes/startup-runtime.ts";
import { type AppStateApiService } from "@/services/app-state/app-state-api-service.ts";

import { createWindow } from "./application/create-window.ts";
import { runElectronApplication } from "./application/run-electron-application.ts";
import { shutdownElectronApplication } from "./application/shutdown-electron-application.ts";

const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

app.setPath("userData", appPaths.electronUserData);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

let electronRuntime: ReturnType<typeof makeElectronRuntime> | undefined;

function flushLogs() {
  return Promise.allSettled([
    electronRuntime?.dispose(),
    startupRuntime.dispose(),
  ]).then(() => {
    return undefined;
  });
}

function exitOnFailure<A, Error>(exit: Exit.Exit<A, Error>) {
  return exitOnStartupFailure(exit, { flushLogs });
}

function runElectronMain() {
  return E.gen(function* () {
    const electronRendererHost = yield* appConfig.electronRendererHost;
    const electronRendererPort = yield* appConfig.electronRendererPort;

    yield* E.promise(() => app.whenReady());

    const databaseFilename = yield* getDatabaseFilename();
    const appStateStorageDirectory = appPaths.appState;
    const backgroundJobsDirectory = appPaths.backgroundJobs;
    const encryptionKeyDirectory = appPaths.encryptionKey;

    const runtime = makeElectronRuntime({
      appStateStorageDirectory,
      backgroundJobsDirectory,
      databaseFilename,
      encryptionKeyDirectory,
    });

    electronRuntime = runtime;

    // [TODO] Research patterns
    // Build the runtime's layers up front so a failure (database, API server,
    // etc.) fails startup and is logged, rather than failing the first
    // `runProgram` call before its `logCause` can run.
    yield* runtime.contextEffect;

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

    function runProgram<A, ProgramError>(
      effect: E.Effect<A, ProgramError, Path.Path | AppStateApiService>,
    ) {
      return runtime.runPromiseExit(effect.pipe(E.tapCause(logCause)));
    }

    configureErrorLogging(runtime);
    configureWebContentsSecurity({
      appBaseUrl,
      preloadPath: path.join(currentDirectoryPath, "preload.cjs"),
    });
    configureWindowIpc(runtime);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void runProgram(createWindow(windowOptions));
      }
    });

    app.once("before-quit", (event) => {
      event.preventDefault();

      void runProgram(
        shutdownElectronApplication({
          runtime,
        }).pipe(
          E.ensuring(E.promise(() => startupRuntime.dispose())),
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

    void runProgram(runElectronApplication(windowOptions)).then(exitOnFailure);
  });
}

if (hasSingleInstanceLock) {
  void startupRuntime
    .runPromiseExit(runElectronMain().pipe(E.tapCause(logCause)))
    .then(exitOnFailure);
} else {
  app.quit();
}
