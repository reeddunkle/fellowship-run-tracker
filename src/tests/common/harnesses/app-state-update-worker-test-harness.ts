import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateUpdateWorker } from "@/services/app-state/make-app-state-update-worker.ts";

type UpdateRequest<UpdateError> = {
  readonly deferred: Deferred.Deferred<void, UpdateError>;
  readonly state: AppState;
};

export function makeAppStateUpdateWorkerTestHarness<UpdateError = never>() {
  return E.gen(function* () {
    const updateRequests = yield* Queue.unbounded<UpdateRequest<UpdateError>>();

    const updatedStatesRef = yield* Ref.make<ReadonlyArray<AppState>>([]);

    const worker = yield* makeAppStateUpdateWorker((state) => {
      return E.gen(function* () {
        const deferred = yield* Deferred.make<void, UpdateError>();

        yield* Ref.update(updatedStatesRef, (updatedStates) => {
          return [...updatedStates, state];
        });

        yield* Queue.offer(updateRequests, {
          deferred,
          state,
        });

        yield* Deferred.await(deferred);
      });
    });

    const start = (state: AppState) => {
      return E.gen(function* () {
        const fiber = yield* E.forkChild(worker.set(state));
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

        const fail = (error: UpdateError) => {
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

    const getUpdatedStates = () => {
      return Ref.get(updatedStatesRef);
    };

    return {
      getUpdatedStates,
      start,
      takeUpdate,
    };
  });
}
