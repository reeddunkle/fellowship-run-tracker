import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { AppStateSchema } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateStorage } from "@/electron/storage/app-state/app-state-storage.ts";
import { AppStateUpdateWorker } from "@/services/app-state/app-state-update-worker/app-state-update-worker-service.ts";

export function getAppState() {
  return E.gen(function* () {
    const appStateStorage = yield* AppStateStorage;

    return yield* appStateStorage.get;
  });
}

export function setAppState(input: unknown) {
  return E.gen(function* () {
    const appStateUpdateWorker = yield* AppStateUpdateWorker;

    const appState = yield* Schema.decodeUnknownEffect(AppStateSchema)(input);

    yield* appStateUpdateWorker.submit(appState);
  });
}
