import { dialog, shell, type WindowOpenHandlerResponse } from "electron";

export function isFellowshipLogsReportUrl(url: string): boolean {
  return url.startsWith("https://www.fellowshiplogs.com/reports/");
}

export function handleFellowshipLogsWindowOpen({
  url,
}: {
  readonly url: string;
}): WindowOpenHandlerResponse {
  void shell.openExternal(url).catch((error: unknown) => {
    dialog.showErrorBox("Unable to open Fellowship Logs", String(error));
  });

  return { action: "deny" };
}
