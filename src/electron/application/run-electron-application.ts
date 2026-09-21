import * as E from "effect/Effect";
import { nativeTheme } from "electron";

import { AppStateApiService } from "@/contracts/app-state/app-state-api-service.ts";
import { type Theme } from "@/contracts/app-state/app-state-schema.ts";

import { type CreateWindowOptions, createWindow } from "./create-window.ts";

export type RunElectronApplicationOptions = CreateWindowOptions;

function applyNativeTheme(theme: Theme) {
  return E.sync(() => {
    nativeTheme.themeSource = theme;
  });
}

export function runElectronApplication(options: RunElectronApplicationOptions) {
  return E.scoped(
    E.gen(function* () {
      const appStateService = yield* AppStateApiService;
      const theme = yield* appStateService.getTheme;

      yield* applyNativeTheme(theme);

      yield* createWindow(options);

      return yield* E.never;
    }),
  );
}
