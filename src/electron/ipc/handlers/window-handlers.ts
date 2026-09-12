import * as Schema from "effect/Schema";
import { BrowserWindow, screen } from "electron";

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

export function resizeWindowToContent(
  sender: Electron.WebContents,
  input: unknown,
): void {
  const window = BrowserWindow.fromWebContents(sender);

  if (window === null) {
    return;
  }

  const { height, width } = Schema.decodeUnknownSync(
    ResizeWindowToContentArgsSchema,
  )(input);

  const display = screen.getDisplayMatching(window.getBounds());

  const maxHeight = display.workAreaSize.height - WINDOW_VERTICAL_MARGIN;
  const maxWidth = display.workAreaSize.width - WINDOW_HORIZONTAL_MARGIN;

  window.setContentSize(
    Math.min(Math.ceil(width), maxWidth),
    Math.min(Math.ceil(height), maxHeight),
  );
}
