import * as Match from "effect/Match";
import { type WebContents, type WindowOpenHandlerResponse } from "electron";

import { isExternalUrl } from "@/application/app-url.ts";

import {
  handleDetachedWindowOpen,
  isBlankWindowUrl,
  isDetachedWindowFeatures,
} from "./handle-detached-window-open.ts";
import { handleExternalWindowOpen } from "./handle-external-window-open.ts";

export function configureWindowOpenHandler({
  preloadPath,
  webContents,
}: {
  readonly preloadPath: string;
  readonly webContents: WebContents;
}) {
  webContents.setWindowOpenHandler((details) => {
    return Match.value(details).pipe(
      Match.when(
        { features: isDetachedWindowFeatures, url: isBlankWindowUrl },
        () => {
          return handleDetachedWindowOpen({ preloadPath });
        },
      ),
      Match.when({ url: isExternalUrl }, handleExternalWindowOpen),
      Match.orElse((): WindowOpenHandlerResponse => {
        return { action: "deny" };
      }),
    );
  });
}
