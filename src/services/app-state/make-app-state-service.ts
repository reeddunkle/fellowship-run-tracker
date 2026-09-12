import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import type * as Scope from "effect/Scope";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

import { type AppStateServiceShape } from "./app-state-service.ts";
import { makeAppStateUpdateWorker } from "./make-app-state-update-worker.ts";

export function makeAppStateService<ProcessError, Requirements>({
  initialState,
  process,
}: {
  readonly initialState: AppState;
  readonly process: (
    state: AppState,
  ) => E.Effect<void, ProcessError, Requirements>;
}): E.Effect<AppStateServiceShape, never, Requirements | Scope.Scope> {
  return E.gen(function* () {
    const stateRef = yield* Ref.make(initialState);

    const updateWorker = yield* makeAppStateUpdateWorker((state) => {
      return process(state).pipe(E.andThen(Ref.set(stateRef, state)));
    });

    return {
      get: Ref.get(stateRef),
      set: updateWorker.set,
    };
  });
}
