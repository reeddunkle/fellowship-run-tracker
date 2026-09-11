import * as A from "effect/Array";
import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { ELECTRON_IPC_CHANNEL } from "@/electron/ipc/electron-ipc-channel.ts";
import { AppStateSchema } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { FilePathSchema } from "@/validation/common-schemas.ts";

const GetDirectoryPathArgsSchema = Schema.Struct({
  filePath: FilePathSchema,
  relativePath: FilePathSchema,
});

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
    (_event, input: unknown) => {
      return runtime.runPromise(
        E.gen(function* () {
          const appStateStorage = yield* AppStateStorage;

          const appState =
            yield* Schema.decodeUnknownEffect(AppStateSchema)(input);

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
    (_event, input: unknown) => {
      return runtime.runPromise(
        E.gen(function* () {
          const path = yield* Path.Path;

          const { filePath, relativePath } = yield* Schema.decodeUnknownEffect(
            GetDirectoryPathArgsSchema,
          )(input);

          const relativePathParts = relativePath.split("/");

          const directoryPath = A.reduce(
            relativePathParts,
            filePath,
            (currentDirectoryPath, _relativePathPart, index) => {
              return index === 0
                ? currentDirectoryPath
                : path.dirname(currentDirectoryPath);
            },
          );

          return directoryPath;
        }),
      );
    },
  );
}
