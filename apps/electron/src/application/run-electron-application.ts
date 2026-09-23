import * as E from "effect/Effect";
import { app, type BrowserWindow, nativeTheme } from "electron";

import { type Theme } from "@frt/shared/app-state/app-state-schema.ts";

import { AppStateApiService } from "@/services/app-state/app-state-api-service.ts";

import { type CreateWindowOptions, createWindow } from "./create-window.ts";

export type RunElectronApplicationOptions = CreateWindowOptions;

function applyNativeTheme(theme: Theme) {
  return E.sync(() => {
    nativeTheme.themeSource = theme;
  });
}

function focusWindowOnSecondInstance(window: BrowserWindow) {
  function focusWindow() {
    if (window.isDestroyed()) {
      return;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window.show();
    window.focus();
  }

  return E.acquireRelease(
    E.sync(() => {
      app.on("second-instance", focusWindow);
    }),
    () => {
      return E.sync(() => {
        app.off("second-instance", focusWindow);
      });
    },
  );
}

export function runElectronApplication(options: RunElectronApplicationOptions) {
  return E.scoped(
    E.gen(function* () {
      const appStateService = yield* AppStateApiService;
      const theme = yield* appStateService.getTheme;

      yield* applyNativeTheme(theme);

      const window = yield* createWindow(options);

      yield* focusWindowOnSecondInstance(window);

      return yield* E.never;
    }),
  );
}
