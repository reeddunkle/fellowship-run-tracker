import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import * as appStateClient from "@/electron/renderer/api/electron-ipc/app-state/app-state-client.ts";
import { AppStateService } from "@/services/app-state/app-state-service.ts";
import { makeAppStateUpdateWorker } from "@/services/app-state/make-app-state-update-worker.ts";

export const BrowserAppStateLive = Layer.effect(
  AppStateService,
  E.gen(function* () {
    const updateWorker = yield* makeAppStateUpdateWorker(
      appStateClient.setAppState,
    );

    return {
      get: appStateClient.getAppState,
      set: updateWorker.set,
    };
  }),
);
