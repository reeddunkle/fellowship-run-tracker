import * as Match from "effect/Match";
import { type BrowserWindow, type WindowOpenHandlerResponse } from "electron";

import {
  handleDetachedWindowOpen,
  isDetachedWindowFeatures,
} from "./handle-detached-window-open.ts";
import {
  handleFellowshipLogsWindowOpen,
  isFellowshipLogsReportUrl,
} from "./handle-fellowship-logs-window-open.ts";

export function configureWindowOpenHandler({
  preloadPath,
  window,
}: {
  readonly preloadPath: string;
  readonly window: BrowserWindow;
}) {
  window.webContents.setWindowOpenHandler((details) => {
    return Match.value(details).pipe(
      Match.when(
        { url: isFellowshipLogsReportUrl },
        handleFellowshipLogsWindowOpen,
      ),
      Match.when({ features: isDetachedWindowFeatures }, () => {
        return handleDetachedWindowOpen({ preloadPath });
      }),
      Match.orElse((): WindowOpenHandlerResponse => {
        return { action: "allow" };
      }),
    );
  });
}
