import { app } from "electron";

import { isAppUrl, isExternalUrl } from "@/application/app-url.ts";
import { configureZoomShortcuts } from "@/application/configure-zoom-shortcuts.ts";
import { configureWindowOpenHandler } from "@/application/window-open-handler/configure-window-open-handler.ts";
import { openExternalUrl } from "@/application/window-open-handler/handle-external-window-open.ts";

export function configureWebContentsSecurity({
  appBaseUrl,
  preloadPath,
}: {
  readonly appBaseUrl: string;
  readonly preloadPath: string;
}) {
  app.on("web-contents-created", (_event, webContents) => {
    configureZoomShortcuts(webContents);
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
