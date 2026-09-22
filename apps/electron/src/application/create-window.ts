import * as E from "effect/Effect";
import * as Path from "effect/Path";
import { BrowserWindow, nativeTheme } from "electron";

import { ElectronWindowCreationError } from "@/errors/electron-error.ts";

export type CreateWindowOptions = {
  readonly currentDirectoryPath: string;
  readonly rendererDevServerUrl: string | undefined;
};

const LIGHT_BACKGROUND_COLOR = "#ffffff";
const DARK_BACKGROUND_COLOR = "#0a0a0a";

function getWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors
    ? DARK_BACKGROUND_COLOR
    : LIGHT_BACKGROUND_COLOR;
}

export function createWindow({
  currentDirectoryPath,
  rendererDevServerUrl,
}: CreateWindowOptions) {
  return E.gen(function* () {
    const path = yield* Path.Path;

    const preloadPath = path.join(currentDirectoryPath, "preload.cjs");

    const window = yield* E.sync(() => {
      const createdWindow = new BrowserWindow({
        backgroundColor: getWindowBackgroundColor(),
        height: 1100,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: preloadPath,
          sandbox: true,
        },
        width: 1500,
      });

      createdWindow.once("ready-to-show", () => {
        createdWindow.show();
      });

      return createdWindow;
    });

    yield* E.tryPromise({
      catch: (cause) => {
        return new ElectronWindowCreationError({
          cause,
        });
      },
      try: () => {
        if (rendererDevServerUrl !== undefined) {
          return window.loadURL(rendererDevServerUrl);
        }

        return window.loadFile(
          path.join(currentDirectoryPath, "renderer/index.html"),
        );
      },
    });

    return window;
  });
}
