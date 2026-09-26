import * as E from "effect/Effect";
import { dialog, shell, type WindowOpenHandlerResponse } from "electron";

import { electronRuntime } from "@/runtimes/electron-runtime.ts";

export function openExternalUrl(url: string) {
  void shell.openExternal(url).catch((error: unknown) => {
    electronRuntime.runFork(
      E.logWarning("Failed to open an external link.", {
        cause: String(error),
      }),
    );

    dialog.showErrorBox("Unable to open link", String(error));
  });
}

export function handleExternalWindowOpen({
  url,
}: {
  readonly url: string;
}): WindowOpenHandlerResponse {
  openExternalUrl(url);

  return { action: "deny" };
}
