import { type WindowBounds } from "@/services/window-state/window-state-schema.ts";

export type WindowSize = {
  readonly height: number;
  readonly width: number;
};

export type WindowAnchor = {
  readonly horizontal: "left" | "right";
  readonly vertical: "top" | "bottom";
  readonly x: number;
  readonly y: number;
};

export type InitialWindowBounds = WindowSize & {
  readonly x?: number;
  readonly y?: number;
};

const PREFERRED_WINDOW_WIDTH = 1500;
const PREFERRED_WINDOW_HEIGHT = 1100;
const DEFAULT_WORK_AREA_RATIO = 0.9;
const MIN_WINDOW_WIDTH = 960;
const MIN_WINDOW_HEIGHT = 640;
const MIN_VISIBLE_OVERLAP = 64;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getDefaultWindowSize(workArea: WindowBounds): WindowSize {
  return {
    height: Math.min(
      PREFERRED_WINDOW_HEIGHT,
      Math.floor(workArea.height * DEFAULT_WORK_AREA_RATIO),
    ),
    width: Math.min(
      PREFERRED_WINDOW_WIDTH,
      Math.floor(workArea.width * DEFAULT_WORK_AREA_RATIO),
    ),
  };
}

export function getMinimumWindowSize(workArea: WindowBounds): WindowSize {
  return {
    height: Math.min(MIN_WINDOW_HEIGHT, workArea.height),
    width: Math.min(MIN_WINDOW_WIDTH, workArea.width),
  };
}

function getOverlap(first: WindowBounds, second: WindowBounds): WindowSize {
  return {
    height:
      Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
    width:
      Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  };
}

function isVisiblyWithin(bounds: WindowBounds, workArea: WindowBounds) {
  const overlap = getOverlap(bounds, workArea);

  return (
    overlap.width >= MIN_VISIBLE_OVERLAP &&
    overlap.height >= MIN_VISIBLE_OVERLAP
  );
}

export function findVisibleWorkArea(
  bounds: WindowBounds,
  workAreas: ReadonlyArray<WindowBounds>,
) {
  return workAreas.find((workArea) => {
    return isVisiblyWithin(bounds, workArea);
  });
}

export function fitBoundsToWorkArea(
  bounds: WindowBounds,
  workArea: WindowBounds,
): WindowBounds {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);

  return {
    height,
    width,
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - height),
  };
}

export function centerBoundsInWorkArea(
  size: WindowSize,
  workArea: WindowBounds,
): WindowBounds {
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);

  return {
    height,
    width,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
  };
}

export function getWindowAnchor(
  bounds: WindowBounds,
  workArea: WindowBounds,
): WindowAnchor {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  const isNearerRight =
    workArea.x + workArea.width - right < bounds.x - workArea.x;
  const isNearerBottom =
    workArea.y + workArea.height - bottom < bounds.y - workArea.y;

  return {
    horizontal: isNearerRight ? "right" : "left",
    vertical: isNearerBottom ? "bottom" : "top",
    x: isNearerRight ? right : bounds.x,
    y: isNearerBottom ? bottom : bounds.y,
  };
}

export function placeAtAnchor(
  size: WindowSize,
  anchor: WindowAnchor,
): WindowBounds {
  return {
    height: size.height,
    width: size.width,
    x: anchor.horizontal === "right" ? anchor.x - size.width : anchor.x,
    y: anchor.vertical === "bottom" ? anchor.y - size.height : anchor.y,
  };
}

export function resolveInitialWindowBounds({
  defaultWorkArea,
  savedBounds,
  workAreas,
}: {
  readonly defaultWorkArea: WindowBounds;
  readonly savedBounds: WindowBounds | undefined;
  readonly workAreas: ReadonlyArray<WindowBounds>;
}): InitialWindowBounds {
  const savedWorkArea =
    savedBounds === undefined
      ? undefined
      : findVisibleWorkArea(savedBounds, workAreas);

  if (savedBounds === undefined || savedWorkArea === undefined) {
    return getDefaultWindowSize(defaultWorkArea);
  }

  return fitBoundsToWorkArea(savedBounds, savedWorkArea);
}
