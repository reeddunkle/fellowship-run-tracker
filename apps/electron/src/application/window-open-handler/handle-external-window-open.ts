import { dialog, shell, type WindowOpenHandlerResponse } from "electron";

export function openExternalUrl(url: string) {
  void shell.openExternal(url).catch((error: unknown) => {
    dialog.showErrorBox("Unable to open link", String(error));
  });
}

/**
 * Opens web links in the user's default browser rather than in an app window,
 * which would otherwise load them with the app's preload API.
 */
export function handleExternalWindowOpen({
  url,
}: {
  readonly url: string;
}): WindowOpenHandlerResponse {
  openExternalUrl(url);

  return { action: "deny" };
}
