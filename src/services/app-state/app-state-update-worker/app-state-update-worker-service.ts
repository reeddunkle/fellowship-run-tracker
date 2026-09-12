import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

export type AppStateUpdateWorkerService = {
  readonly submit: (state: AppState) => E.Effect<void, unknown>;
};

export class AppStateUpdateWorker extends Context.Service<
  AppStateUpdateWorker,
  AppStateUpdateWorkerService
>()(
  "fellowship-run-tracker/services/app-state-update-worker/app-state-update-worker-service/AppStateUpdateWorker",
) {}
