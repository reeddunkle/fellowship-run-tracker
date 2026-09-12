import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateUpdateWorker } from "@/services/app-state/app-state-update-worker/app-state-update-worker-service.ts";
import { makeAppStateUpdateWorker } from "@/services/app-state/app-state-update-worker/make-app-state-update-worker.ts";

export function makeAppStateUpdateWorkerTestLayer<E, R>(
  process: (state: AppState) => E.Effect<void, E, R>,
) {
  return Layer.effect(AppStateUpdateWorker, makeAppStateUpdateWorker(process));
}
