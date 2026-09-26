import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import type * as Path from "effect/Path";
import { ipcMain } from "electron";

import { logCause } from "@frt/api/logging/log-cause.ts";

import { ELECTRON_IPC_CHANNEL } from "@/ipc/electron-ipc-channel.ts";
import { handleAppStateRequest } from "@/ipc/handlers/app-state-handlers.ts";
import { getFileDirectoryPath } from "@/ipc/handlers/get-file-directory-path.ts";
import { openLogsFolder } from "@/ipc/handlers/logs-handlers.ts";
import { makeRendererLogHandler } from "@/ipc/handlers/renderer-log-handler.ts";
import {
  resizeWindowToContent,
  showWindow,
} from "@/ipc/handlers/window-handlers.ts";
import { type AppState } from "@/services/app-state/app-state-service.ts";

export function configureWindowIpc<RuntimeError>(
  runtime: ManagedRuntime.ManagedRuntime<AppState | Path.Path, RuntimeError>,
) {
  function runHandler<A, HandlerError>(
    effect: E.Effect<A, HandlerError, AppState | Path.Path>,
  ) {
    return runtime.runPromise(effect.pipe(E.tapCause(logCause)));
  }

  const logRendererEntry = makeRendererLogHandler();

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.RESIZE_WINDOW_TO_CONTENT,
    (event, input: unknown) => {
      return runHandler(resizeWindowToContent(event.sender, input));
    },
  );
  ipcMain.handle(ELECTRON_IPC_CHANNEL.APP_STATE_RPC, (_event, input) => {
    return runHandler(handleAppStateRequest(input));
  });

  ipcMain.on(ELECTRON_IPC_CHANNEL.SHOW_WINDOW, (event) => {
    showWindow(event.sender);
  });

  ipcMain.handle(ELECTRON_IPC_CHANNEL.LOGS_OPEN_FOLDER, () => {
    return runHandler(openLogsFolder());
  });

  ipcMain.on(ELECTRON_IPC_CHANNEL.LOG_WRITE, (_event, input: unknown) => {
    runtime.runFork(logRendererEntry(input));
  });

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.FILE_GET_DIRECTORY_PATH,
    (_event, input: unknown) => {
      return runHandler(getFileDirectoryPath(input));
    },
  );
}
