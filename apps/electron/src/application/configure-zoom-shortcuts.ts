import { type Input, type WebContents } from "electron";

const ZOOM_LEVEL_STEP = 0.5;
const MIN_ZOOM_LEVEL = -3;
const MAX_ZOOM_LEVEL = 5;

type ZoomAction = "in" | "out" | "reset";

const ZOOM_ACTION_BY_KEY: Readonly<Record<string, ZoomAction>> = {
  _: "out",
  "-": "out",
  "+": "in",
  "=": "in",
  "0": "reset",
};

const ZOOM_ACTION_BY_CODE: Readonly<Record<string, ZoomAction>> = {
  Numpad0: "reset",
  NumpadAdd: "in",
  NumpadSubtract: "out",
};

function getZoomAction(input: Input): ZoomAction | undefined {
  const hasZoomModifier = input.control || input.meta;

  if (input.type !== "keyDown" || !hasZoomModifier || input.alt) {
    return undefined;
  }

  return ZOOM_ACTION_BY_CODE[input.code] ?? ZOOM_ACTION_BY_KEY[input.key];
}

function clampZoomLevel(zoomLevel: number) {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, zoomLevel));
}

function getNextZoomLevel(currentZoomLevel: number, action: ZoomAction) {
  const nextZoomLevelByAction: Record<ZoomAction, number> = {
    in: currentZoomLevel + ZOOM_LEVEL_STEP,
    out: currentZoomLevel - ZOOM_LEVEL_STEP,
    reset: 0,
  };

  return clampZoomLevel(nextZoomLevelByAction[action]);
}

export function configureZoomShortcuts(webContents: WebContents) {
  webContents.on("before-input-event", (event, input) => {
    const action = getZoomAction(input);

    if (action === undefined) {
      return;
    }

    event.preventDefault();

    webContents.setZoomLevel(
      getNextZoomLevel(webContents.getZoomLevel(), action),
    );
  });
}
