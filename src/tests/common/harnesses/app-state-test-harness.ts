import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";

import {
  type AppState,
  DEFAULT_APP_STATE,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateService } from "@/services/app-state/make-app-state-service.ts";

type UpdateRequest<ProcessError> = {
  readonly deferred: Deferred.Deferred<void, ProcessError>;
  readonly state: AppState;
};

export function makeAppStateTestHarness<ProcessError = never>({
  initialState = DEFAULT_APP_STATE,
}: {
  readonly initialState?: AppState;
} = {}) {
  return E.gen(function* () {
    const updateRequests =
      yield* Queue.unbounded<UpdateRequest<ProcessError>>();

    const updatedStatesRef = yield* Ref.make<ReadonlyArray<AppState>>([]);

    const appState = yield* makeAppStateService({
      initialState,
      process: (state) => {
        return E.gen(function* () {
          const deferred = yield* Deferred.make<void, ProcessError>();

          yield* Ref.update(updatedStatesRef, (updatedStates) => {
            return [...updatedStates, state];
          });

          yield* Queue.offer(updateRequests, {
            deferred,
            state,
          });

          yield* Deferred.await(deferred);
        });
      },
    });

    const start = (state: AppState) => {
      return E.gen(function* () {
        const fiber = yield* E.forkChild(appState.set(state));
        const join = Fiber.join(fiber);

        return {
          join,
          result: E.result(join),
        };
      });
    };

    const takeUpdate = () => {
      return E.gen(function* () {
        const request = yield* Queue.take(updateRequests);

        const fail = (error: ProcessError) => {
          return Deferred.fail(request.deferred, error).pipe(E.asVoid);
        };

        const succeed = Deferred.succeed(request.deferred, undefined).pipe(
          E.asVoid,
        );

        return {
          fail,
          state: request.state,
          succeed,
        };
      });
    };

    const startAndTakeUpdate = (state: AppState) => {
      return E.gen(function* () {
        const submission = yield* start(state);
        const update = yield* takeUpdate();

        return {
          submission,
          update,
        };
      });
    };

    const getUpdatedStates = () => {
      return Ref.get(updatedStatesRef);
    };

    return {
      appState,
      getUpdatedStates,
      start,
      startAndTakeUpdate,
      takeUpdate,
    };
  });
}
