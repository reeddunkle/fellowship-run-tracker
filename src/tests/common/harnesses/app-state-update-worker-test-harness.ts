import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";
import { makeAppStateUpdateWorker } from "@/services/app-state-update-worker/make-app-state-update-worker.ts";

type ProcessRequest<ProcessError> = {
  readonly deferred: Deferred.Deferred<void, ProcessError>;
  readonly state: AppState;
};

export function makeAppStateUpdateWorkerTestHarness<ProcessError = never>() {
  return E.gen(function* () {
    const processingRequests =
      yield* Queue.unbounded<ProcessRequest<ProcessError>>();

    const processedStatesRef = yield* Ref.make<ReadonlyArray<AppState>>([]);

    const worker = yield* makeAppStateUpdateWorker((state) => {
      return E.gen(function* () {
        const deferred = yield* Deferred.make<void, ProcessError>();

        yield* Ref.update(processedStatesRef, (processedStates) => {
          return [...processedStates, state];
        });

        yield* Queue.offer(processingRequests, {
          deferred,
          state,
        });

        yield* Deferred.await(deferred);
      });
    });

    const start = (state: AppState) => {
      return E.gen(function* () {
        const fiber = yield* E.forkChild(worker.submit(state));
        const join = Fiber.join(fiber);

        return {
          join,
          result: E.result(join),
        };
      });
    };

    const takeProcess = () => {
      return E.gen(function* () {
        const request = yield* Queue.take(processingRequests);

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

    const startAndTakeProcess = (state: AppState) => {
      return E.gen(function* () {
        const submission = yield* start(state);
        const process = yield* takeProcess();

        return {
          process,
          submission,
        };
      });
    };

    const getProcessedStates = () => {
      return Ref.get(processedStatesRef);
    };

    return {
      getProcessedStates,
      start,
      startAndTakeProcess,
      takeProcess,
      worker,
    };
  });
}
