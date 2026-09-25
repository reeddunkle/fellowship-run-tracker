import * as E from "effect/Effect";
import * as Option from "effect/Option";
import { app, BrowserWindow, screen, type WebContents } from "electron";

import {
  findVisibleWorkArea,
  placeAtAnchor,
} from "@/application/window-bounds.ts";
import { trackWindowStateSaves } from "@/application/window-state-tracking.ts";
import {
  type DetachedWindowStateValue,
  type WindowBounds,
} from "@/services/window-state/window-state-schema.ts";
import { WindowState } from "@/services/window-state/window-state-service.ts";

import {
  anchorPlacementToBounds,
  anchorToCurrentBounds,
  setDetachedWindowPlacement,
} from "./detached-window-placement.ts";

function getOpenerWorkArea(opener: WebContents) {
  const openerWindow = BrowserWindow.fromWebContents(opener);

  const display =
    openerWindow === null
      ? screen.getPrimaryDisplay()
      : screen.getDisplayMatching(openerWindow.getBounds());

  return display.workArea;
}

function getConnectedWorkAreas() {
  return screen.getAllDisplays().map((display) => {
    return display.workArea;
  });
}

function placeDetachedWindow({
  detachedWindow,
  opener,
  savedState,
}: {
  readonly detachedWindow: BrowserWindow;
  readonly opener: WebContents;
  readonly savedState: Option.Option<DetachedWindowStateValue>;
}) {
  const savedPlacement = Option.flatMap(savedState, ({ bounds }) => {
    return Option.map(
      Option.fromUndefinedOr(
        findVisibleWorkArea(bounds, getConnectedWorkAreas()),
      ),
      (workArea) => {
        return anchorPlacementToBounds(bounds, workArea);
      },
    );
  });

  Option.match(savedPlacement, {
    onNone: () => {
      const workArea = getOpenerWorkArea(opener);

      detachedWindow.setPosition(workArea.x, workArea.y);
      setDetachedWindowPlacement(detachedWindow, {
        _tag: "PendingCenter",
        workArea,
      });
    },
    onSome: (placement) => {
      const { x, y } = placeAtAnchor(
        detachedWindow.getBounds(),
        placement.anchor,
      );

      detachedWindow.setPosition(x, y);
      setDetachedWindowPlacement(detachedWindow, placement);
    },
  });
}

export function configureDetachedWindowPlacement() {
  return E.gen(function* () {
    const windowState = yield* WindowState;
    const runPromise = E.runPromiseWith(yield* E.context<WindowState>());

    let savedState = yield* windowState.getDetachedWindowState;

    const saveDetachedWindowState = (state: DetachedWindowStateValue) => {
      savedState = Option.some(state);

      return runPromise(windowState.setDetachedWindowState(state));
    };

    yield* E.sync(() => {
      app.on("web-contents-created", (_event, opener) => {
        opener.on("did-create-window", (detachedWindow) => {
          placeDetachedWindow({ detachedWindow, opener, savedState });

          let lastUserBounds: WindowBounds | undefined;

          trackWindowStateSaves({
            getSnapshot: () => {
              return lastUserBounds === undefined
                ? undefined
                : { bounds: lastUserBounds };
            },
            save: saveDetachedWindowState,
            subscribe: (scheduleSave) => {
              const recordUserPlacement = () => {
                lastUserBounds = anchorToCurrentBounds(detachedWindow);
                scheduleSave();
              };

              detachedWindow.on("moved", recordUserPlacement);
              detachedWindow.on("resized", recordUserPlacement);
            },
            window: detachedWindow,
          });
        });
      });
    });
  });
}
