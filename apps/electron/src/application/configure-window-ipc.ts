import type * as ManagedRuntime from "effect/ManagedRuntime";
import type * as Path from "effect/Path";
import { ipcMain } from "electron";

import { ELECTRON_IPC_CHANNEL } from "@/ipc/electron-ipc-channel.ts";
import { handleAppStateRequest } from "@/ipc/handlers/app-state-handlers.ts";
import { getFileDirectoryPath } from "@/ipc/handlers/get-file-directory-path.ts";
import {
  resizeWindowToContent,
  showWindow,
} from "@/ipc/handlers/window-handlers.ts";
import { type AppState } from "@/services/app-state/app-state-service.ts";

export function configureWindowIpc<RuntimeError>(
  runtime: ManagedRuntime.ManagedRuntime<AppState | Path.Path, RuntimeError>,
) {
  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.RESIZE_WINDOW_TO_CONTENT,
    (event, input: unknown) => {
      return runtime.runPromise(resizeWindowToContent(event.sender, input));
    },
  );
  ipcMain.handle(ELECTRON_IPC_CHANNEL.APP_STATE_RPC, (_event, input) => {
    return runtime.runPromise(handleAppStateRequest(input));
  });

  ipcMain.on(ELECTRON_IPC_CHANNEL.SHOW_WINDOW, (event) => {
    showWindow(event.sender);
  });

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.FILE_GET_DIRECTORY_PATH,
    (_event, input: unknown) => {
      return runtime.runPromise(getFileDirectoryPath(input));
    },
  );
}
