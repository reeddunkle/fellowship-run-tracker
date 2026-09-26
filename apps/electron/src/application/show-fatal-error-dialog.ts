import { app, dialog, shell } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

const DIALOG_BUTTONS = ["Open logs folder", "Close"];

const OPEN_LOGS_FOLDER_BUTTON_INDEX = 0;

const CLOSE_BUTTON_INDEX = 1;

type ShowFatalErrorDialogOptions = {
  readonly detail: string;
  readonly title: string;
};

export function showFatalErrorDialog({
  detail,
  title,
}: ShowFatalErrorDialogOptions): Promise<void> {
  const detailWithLogs = `${detail}\n\nLogs: ${appPaths.logs}`;

  if (!app.isReady()) {
    dialog.showErrorBox(title, detailWithLogs);

    return Promise.resolve();
  }

  return dialog
    .showMessageBox({
      buttons: DIALOG_BUTTONS,
      cancelId: CLOSE_BUTTON_INDEX,
      defaultId: CLOSE_BUTTON_INDEX,
      detail: detailWithLogs,
      message: title,
      noLink: true,
      title,
      type: "error",
    })
    .then(({ response }) => {
      return response === OPEN_LOGS_FOLDER_BUTTON_INDEX
        ? shell.openPath(appPaths.logs)
        : undefined;
    })
    .then(() => undefined);
}
