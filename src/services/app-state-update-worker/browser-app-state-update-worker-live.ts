import * as Layer from "effect/Layer";

import * as appStateClient from "@/electron/renderer/api/electron-ipc/app-state/app-state-client.ts";

import { AppStateUpdateWorker } from "./app-state-update-worker-service.ts";
import { makeAppStateUpdateWorker } from "./make-app-state-update-worker.ts";

export const BrowserAppStateUpdateWorkerLive = Layer.effect(
  AppStateUpdateWorker,
  makeAppStateUpdateWorker(appStateClient.setAppState),
);
