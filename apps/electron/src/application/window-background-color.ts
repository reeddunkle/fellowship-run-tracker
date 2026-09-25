import { nativeTheme } from "electron";

const LIGHT_BACKGROUND_COLOR = "#ffffff";
const DARK_BACKGROUND_COLOR = "#0a0a0a";

export function getWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors
    ? DARK_BACKGROUND_COLOR
    : LIGHT_BACKGROUND_COLOR;
}
