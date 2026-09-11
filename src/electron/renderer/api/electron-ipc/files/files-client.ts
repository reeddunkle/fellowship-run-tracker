import * as E from "effect/Effect";

import { FilesClientError } from "@/errors/electron-error.ts";

export function getDirectoryPath(file: File) {
  return E.tryPromise({
    catch: (cause) => {
      return new FilesClientError({
        cause,
        operation: "GetDirectoryPath",
      });
    },
    try: () => {
      return window.electronAPI.files.getDirectoryPath(file);
    },
  });
}
