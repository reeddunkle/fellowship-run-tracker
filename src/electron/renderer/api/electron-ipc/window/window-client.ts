import * as E from "effect/Effect";

import { WindowClientError } from "@/errors/electron-error.ts";

export function resizeWindowToContent({
  height,
  width,
  window,
}: {
  readonly height: number;
  readonly width: number;
  readonly window: Window;
}) {
  return E.tryPromise({
    catch: (cause) => {
      return new WindowClientError({
        cause,
        operation: "ResizeToContent",
      });
    },
    try: () => {
      return window.electronAPI.resizeWindowToContent({
        height,
        width,
      });
    },
  });
}
