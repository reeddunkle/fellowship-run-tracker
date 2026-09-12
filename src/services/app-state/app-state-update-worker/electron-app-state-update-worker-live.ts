import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { nativeTheme } from "electron";

import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";

import { AppStateUpdateWorker } from "./app-state-update-worker-service.ts";
import { makeAppStateUpdateWorker } from "./make-app-state-update-worker.ts";

export const ElectronAppStateUpdateWorkerLive = Layer.effect(
  AppStateUpdateWorker,
  E.gen(function* () {
    const appStateStorage = yield* AppStateStorage;

    return yield* makeAppStateUpdateWorker((appState) => {
      return E.gen(function* () {
        yield* appStateStorage.set(appState);

        yield* E.sync(() => {
          nativeTheme.themeSource = appState.theme;
        });
      });
    });
  }),
);
