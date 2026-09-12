import type * as ManagedRuntime from "effect/ManagedRuntime";
import type * as Path from "effect/Path";
import { ipcMain } from "electron";

import { ELECTRON_IPC_CHANNEL } from "@/electron/ipc/electron-ipc-channel.ts";
import {
  getAppState,
  setAppState,
} from "@/electron/ipc/handlers/app-state-handlers.ts";
import { getFileDirectoryPath } from "@/electron/ipc/handlers/get-file-directory-path.ts";
import {
  resizeWindowToContent,
  showWindow,
} from "@/electron/ipc/handlers/window-handlers.ts";
import { type AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { type AppStateUpdateWorker } from "@/services/app-state/app-state-service.ts";

export function configureWindowIpc(
  runtime: ManagedRuntime.ManagedRuntime<
    AppStateStorage | AppStateUpdateWorker | Path.Path,
    unknown
  >,
) {
  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.RESIZE_WINDOW_TO_CONTENT,
    (event, input: unknown) => {
      resizeWindowToContent(event.sender, input);
    },
  );

  ipcMain.on(ELECTRON_IPC_CHANNEL.SHOW_WINDOW, (event) => {
    showWindow(event.sender);
  });

  ipcMain.handle(ELECTRON_IPC_CHANNEL.APP_STATE_GET, () => {
    return runtime.runPromise(getAppState());
  });

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.APP_STATE_SET,
    (_event, input: unknown) => {
      return runtime.runPromise(setAppState(input));
    },
  );

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.FILE_GET_DIRECTORY_PATH,
    (_event, input: unknown) => {
      return runtime.runPromise(getFileDirectoryPath(input));
    },
  );
}
