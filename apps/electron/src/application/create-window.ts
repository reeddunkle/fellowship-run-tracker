import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { BrowserWindow, screen } from "electron";

import { ElectronWindowCreationError } from "@/errors/electron-error.ts";
import { type MainWindowStateValue } from "@/services/window-state/window-state-schema.ts";
import { WindowState } from "@/services/window-state/window-state-service.ts";

import { getWindowBackgroundColor } from "./window-background-color.ts";
import {
  getMinimumWindowSize,
  resolveInitialWindowBounds,
} from "./window-bounds.ts";
import { trackWindowStateSaves } from "./window-state-tracking.ts";

export type CreateWindowOptions = {
  readonly currentDirectoryPath: string;
  readonly rendererDevServerUrl: string | undefined;
};

const CHROMIUM_ZOOM_LEVEL_BASE = 1.2;

function getMainWindowStateSnapshot(
  window: BrowserWindow,
): MainWindowStateValue {
  return {
    bounds: window.getNormalBounds(),
    isMaximized: window.isMaximized(),
    zoomLevel: window.webContents.getZoomLevel(),
  };
}

function getZoomFactor(savedWindowState: Option.Option<MainWindowStateValue>) {
  return Option.match(savedWindowState, {
    onNone: () => 1,
    onSome: ({ zoomLevel }) => CHROMIUM_ZOOM_LEVEL_BASE ** zoomLevel,
  });
}

export function createWindow({
  currentDirectoryPath,
  rendererDevServerUrl,
}: CreateWindowOptions) {
  return E.gen(function* () {
    const path = yield* Path.Path;
    const windowState = yield* WindowState;
    const savedWindowState = yield* windowState.getMainWindowState;
    const runPromise = E.runPromiseWith(yield* E.context<WindowState>());

    const preloadPath = path.join(currentDirectoryPath, "preload.cjs");

    const window = yield* E.sync(() => {
      const defaultWorkArea = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
      ).workArea;
      const initialBounds = resolveInitialWindowBounds({
        defaultWorkArea,
        savedBounds: Option.getOrUndefined(savedWindowState)?.bounds,
        workAreas: screen.getAllDisplays().map((display) => {
          return display.workArea;
        }),
      });
      const minimumSize = getMinimumWindowSize(defaultWorkArea);

      const createdWindow = new BrowserWindow({
        ...initialBounds,
        backgroundColor: getWindowBackgroundColor(),
        minHeight: minimumSize.height,
        minWidth: minimumSize.width,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: preloadPath,
          sandbox: true,
          zoomFactor: getZoomFactor(savedWindowState),
        },
      });

      createdWindow.once("ready-to-show", () => {
        if (
          Option.isSome(savedWindowState) &&
          savedWindowState.value.isMaximized
        ) {
          createdWindow.maximize();
        }

        createdWindow.show();
      });

      trackWindowStateSaves({
        getSnapshot: () => {
          return getMainWindowStateSnapshot(createdWindow);
        },
        save: (state) => {
          return runPromise(windowState.setMainWindowState(state));
        },
        subscribe: (scheduleSave) => {
          createdWindow.on("maximize", scheduleSave);
          createdWindow.on("move", scheduleSave);
          createdWindow.on("resize", scheduleSave);
          createdWindow.on("unmaximize", scheduleSave);
          createdWindow.webContents.on("zoom-changed", scheduleSave);
        },
        window: createdWindow,
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
