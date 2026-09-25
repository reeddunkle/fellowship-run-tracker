import { type WindowOpenHandlerResponse } from "electron";

import { getWindowBackgroundColor } from "@/application/window-background-color.ts";

const DETACHED_WINDOW_FEATURE = "detachedWindow=true";

// [KEEP] The renderer opens the detached window empty and renders into it directly.
const BLANK_WINDOW_URLS = new Set(["", "about:blank"]);

export function isBlankWindowUrl(url: string): boolean {
  return BLANK_WINDOW_URLS.has(url);
}

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
      backgroundColor: getWindowBackgroundColor(),
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
