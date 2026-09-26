import * as E from "effect/Effect";

import { DiagnosticsClientError } from "@/errors/diagnostics-client-error.ts";

export function openLogsFolder() {
  return E.tryPromise({
    catch: (cause) => {
      return new DiagnosticsClientError({
        cause,
        operation: "OpenLogsFolder",
      });
    },
    try: () => {
      return window.electronAPI.logs.openFolder();
    },
  });
}
