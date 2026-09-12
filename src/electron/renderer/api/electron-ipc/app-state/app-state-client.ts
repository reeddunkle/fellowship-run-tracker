import * as E from "effect/Effect";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateClientError } from "@/errors/electron-error.ts";

export const getAppState: E.Effect<AppState, AppStateClientError> =
  E.tryPromise({
    catch: (cause) => {
      return new AppStateClientError({
        cause,
        operation: "Get",
      });
    },
    try: () => {
      return window.electronAPI.appState.get();
    },
  });

export function setAppState(state: AppState) {
  return E.tryPromise({
    catch: (cause) => {
      return new AppStateClientError({
        cause,
        operation: "Set",
      });
    },
    try: () => {
      return window.electronAPI.appState.set(state);
    },
  });
}
