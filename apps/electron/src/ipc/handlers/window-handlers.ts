import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { BrowserWindow, screen } from "electron";

import { resolveDetachedWindowBounds } from "@/application/detached-window/detached-window-placement.ts";

export function showWindow(sender: Electron.WebContents): void {
  const window = BrowserWindow.fromWebContents(sender);

  window?.show();
}

const WINDOW_HORIZONTAL_MARGIN = 32;
const WINDOW_VERTICAL_MARGIN = 32;

const ResizeWindowToContentArgsSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});

const decodeResizeWindowToContentArgs = Schema.decodeUnknownEffect(
  ResizeWindowToContentArgsSchema,
);

export function resizeWindowToContent(
  sender: Electron.WebContents,
  input: unknown,
) {
  return E.gen(function* () {
    const window = BrowserWindow.fromWebContents(sender);

    if (window === null) {
      return;
    }

    const { height, width } = yield* decodeResizeWindowToContentArgs(input);

    const windowBounds = window.getBounds();
    const contentBounds = window.getContentBounds();
    const display = screen.getDisplayMatching(windowBounds);

    const maxHeight = display.workAreaSize.height - WINDOW_VERTICAL_MARGIN;
    const maxWidth = display.workAreaSize.width - WINDOW_HORIZONTAL_MARGIN;

    const frameHeight = windowBounds.height - contentBounds.height;
    const frameWidth = windowBounds.width - contentBounds.width;

    window.setBounds(
      resolveDetachedWindowBounds(window, {
        height: Math.min(Math.ceil(height), maxHeight) + frameHeight,
        width: Math.min(Math.ceil(width), maxWidth) + frameWidth,
      }),
    );
  });
}
