import { app } from "electron";

import { isAppUrl, isExternalUrl } from "@/application/app-url.ts";
import { configureWindowOpenHandler } from "@/application/window-open-handler/configure-window-open-handler.ts";
import { openExternalUrl } from "@/application/window-open-handler/handle-external-window-open.ts";

/**
 * Applies to every window's web contents, including detached windows:
 * - `window.open` only opens the app's own detached window; web links go to
 *   the default browser and anything else is denied.
 * - Windows can't navigate away from the app; web links go to the default
 *   browser instead.
 */
export function configureWebContentsSecurity({
  appBaseUrl,
  preloadPath,
}: {
  readonly appBaseUrl: string;
  readonly preloadPath: string;
}) {
  app.on("web-contents-created", (_event, webContents) => {
    configureWindowOpenHandler({
      preloadPath,
      webContents,
    });

    webContents.on("will-navigate", (navigationEvent) => {
      const { url } = navigationEvent;

      if (isAppUrl({ appBaseUrl, url })) {
        return;
      }

      navigationEvent.preventDefault();

      if (isExternalUrl(url)) {
        openExternalUrl(url);
      }
    });
  });
}
