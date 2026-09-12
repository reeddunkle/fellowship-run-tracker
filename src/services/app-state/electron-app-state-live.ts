import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";

import { AppStateService } from "./app-state-service.ts";
import { makeAppStateService } from "./make-app-state-service.ts";

export const ElectronAppStateLive = Layer.effect(
  AppStateService,
  E.gen(function* () {
    const appStateStorage = yield* AppStateStorage;
    const initialState = yield* appStateStorage.get;

    return yield* makeAppStateService({
      initialState,
      process: (appState) => {
        return E.gen(function* () {
          yield* appStateStorage.set(appState);

          yield* E.sync(() => {
            nativeTheme.themeSource = appState.theme;
          });
        });
      },
    });
  }),
);
