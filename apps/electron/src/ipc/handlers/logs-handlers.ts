import * as E from "effect/Effect";
import { shell } from "electron";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

import { ElectronOpenLogsFolderError } from "@/errors/electron-error.ts";

export const openLogsFolder = E.fn("openLogsFolder")(function* () {
  const failureReason = yield* E.promise(() => {
    return shell.openPath(appPaths.logs);
  });

  if (failureReason !== "") {
    return yield* new ElectronOpenLogsFolderError({ reason: failureReason });
  }
});
