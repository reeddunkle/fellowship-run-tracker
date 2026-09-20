import { type WindowOpenHandlerResponse } from "electron";

const DETACHED_WINDOW_FEATURE = "detachedWindow=true";

export function isDetachedWindowFeatures(features: string): boolean {
  return features
    .split(",")
    .map((feature) => {
      return feature.trim();
    })
    .includes(DETACHED_WINDOW_FEATURE);
}

export function handleDetachedWindowOpen({
  preloadPath,
}: {
  readonly preloadPath: string;
}): WindowOpenHandlerResponse {
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
}
