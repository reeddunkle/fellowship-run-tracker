import * as E from "effect/Effect";
import { nativeTheme } from "electron";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateService } from "@/services/app-state/app-state-service.ts";

import { type CreateWindowOptions, createWindow } from "./create-window.ts";

export type RunElectronApplicationOptions = CreateWindowOptions;

function applyNativeTheme(theme: AppState["theme"]) {
  return E.sync(() => {
    nativeTheme.themeSource = theme;
  });
}

export function runElectronApplication(options: RunElectronApplicationOptions) {
  return E.scoped(
    E.gen(function* () {
      const appStateService = yield* AppStateService;
      const appState = yield* appStateService.get;

      yield* applyNativeTheme(appState.theme);

      yield* createWindow(options);

      return yield* E.never;
    }),
  );
}
