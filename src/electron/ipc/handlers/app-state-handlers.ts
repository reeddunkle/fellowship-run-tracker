import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { AppStateSchema } from "@/electron/storage/app-state/app-state-schema.ts";
import { AppStateService } from "@/services/app-state/app-state-service.ts";

export function getAppState() {
  return E.gen(function* () {
    const appState = yield* AppStateService;

    return yield* appState.get;
  });
}

export function setAppState(input: unknown) {
  return E.gen(function* () {
    const appState = yield* AppStateService;

    const state = yield* Schema.decodeUnknownEffect(AppStateSchema)(input);

    yield* appState.set(state);
  });
}
