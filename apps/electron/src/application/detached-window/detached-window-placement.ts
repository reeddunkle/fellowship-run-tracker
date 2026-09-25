import * as Match from "effect/Match";
import { type BrowserWindow, screen } from "electron";

import {
  centerBoundsInWorkArea,
  fitBoundsToWorkArea,
  getWindowAnchor,
  placeAtAnchor,
  type WindowAnchor,
  type WindowSize,
} from "@/application/window-bounds.ts";
import { type WindowBounds } from "@/services/window-state/window-state-schema.ts";

type AnchoredPlacement = {
  readonly _tag: "Anchored";
  readonly anchor: WindowAnchor;
  readonly workArea: WindowBounds;
};

type DetachedWindowPlacement =
  | { readonly _tag: "PendingCenter"; readonly workArea: WindowBounds }
  | AnchoredPlacement;

const detachedWindowPlacements = new WeakMap<
  BrowserWindow,
  DetachedWindowPlacement
>();

export function setDetachedWindowPlacement(
  window: BrowserWindow,
  placement: DetachedWindowPlacement,
) {
  detachedWindowPlacements.set(window, placement);
}

export function anchorPlacementToBounds(
  bounds: WindowBounds,
  workArea: WindowBounds,
): AnchoredPlacement {
  return {
    _tag: "Anchored",
    anchor: getWindowAnchor(bounds, workArea),
    workArea,
  };
}

export function anchorToCurrentBounds(window: BrowserWindow) {
  const bounds = window.getBounds();

  setDetachedWindowPlacement(
    window,
    anchorPlacementToBounds(bounds, screen.getDisplayMatching(bounds).workArea),
  );

  return bounds;
}

export function resolveDetachedWindowBounds(
  window: BrowserWindow,
  size: WindowSize,
): WindowBounds {
  const placement = detachedWindowPlacements.get(window);

  if (placement === undefined) {
    const { x, y } = window.getBounds();

    return fitBoundsToWorkArea(
      { ...size, x, y },
      screen.getDisplayMatching({ ...size, x, y }).workArea,
    );
  }

  return Match.value(placement).pipe(
    Match.tagsExhaustive({
      Anchored: ({ anchor, workArea }) => {
        return fitBoundsToWorkArea(placeAtAnchor(size, anchor), workArea);
      },
      PendingCenter: ({ workArea }) => {
        const centeredBounds = centerBoundsInWorkArea(size, workArea);

        setDetachedWindowPlacement(
          window,
          anchorPlacementToBounds(centeredBounds, workArea),
        );

        return centeredBounds;
      },
    }),
  );
}
