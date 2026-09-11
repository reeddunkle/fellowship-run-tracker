import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import * as Path from "effect/Path";
import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { ELECTRON_IPC_CHANNEL } from "@/electron/ipc/electron-ipc-channel.ts";
import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";

type GetDirectoryPathArgs = {
  readonly filePath: string;
  readonly relativePath: string;
};

export function configureWindowIpc(
  runtime: ManagedRuntime.ManagedRuntime<AppStateStorage | Path.Path, unknown>,
) {
  ipcMain.on(ELECTRON_IPC_CHANNEL.SHOW_WINDOW, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    window?.show();
  });

  ipcMain.handle(ELECTRON_IPC_CHANNEL.APP_STATE_GET, () => {
    return runtime.runPromise(
      E.gen(function* () {
        const appStateStorage = yield* AppStateStorage;

        return yield* appStateStorage.get;
      }),
    );
  });

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.APP_STATE_SET,
    (_event, appState: AppState) => {
      return runtime.runPromise(
        E.gen(function* () {
          const appStateStorage = yield* AppStateStorage;

          yield* appStateStorage.set(appState);

          yield* E.sync(() => {
            nativeTheme.themeSource = appState.theme;
          });
        }),
      );
    },
  );

  ipcMain.handle(
    ELECTRON_IPC_CHANNEL.FILE_GET_DIRECTORY_PATH,
    (_event, { filePath, relativePath }: GetDirectoryPathArgs) => {
      return runtime.runPromise(
        E.gen(function* () {
          const path = yield* Path.Path;

          const relativePathParts = relativePath.split("/");

          let directoryPath = filePath;

          for (
            let parentIndex = 1;
            parentIndex < relativePathParts.length;
            parentIndex += 1
          ) {
            directoryPath = path.dirname(directoryPath);
          }

          return directoryPath;
        }),
      );
    },
  );
}
