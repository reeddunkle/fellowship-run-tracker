import { type BrowserWindow } from "electron";

const DETACHED_WINDOW_FEATURE = "detachedWindow=true";

export function configureWindowOpenHandler({
  preloadPath,
  window,
}: {
  readonly preloadPath: string;
  readonly window: BrowserWindow;
}) {
  window.webContents.setWindowOpenHandler(({ features }) => {
    const isDetachedWindow = features
      .split(",")
      .map((feature) => {
        return feature.trim();
      })
      .includes(DETACHED_WINDOW_FEATURE);

    if (!isDetachedWindow) {
      return {
        action: "allow",
      };
    }

    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        backgroundColor: "#242424",
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: preloadPath,
          sandbox: true,
        },
      },
    };
  });
}
