import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import type * as Scope from "effect/Scope";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

type AppStateUpdateRequest<ProcessError> = {
  readonly deferred: Deferred.Deferred<void, ProcessError>;
  readonly state: AppState;
};

export type AppStateUpdateWorker<ProcessError> = {
  readonly set: (state: AppState) => E.Effect<void, ProcessError>;
};

export function makeAppStateUpdateWorker<ProcessError, Requirements>(
  process: (state: AppState) => E.Effect<void, ProcessError, Requirements>,
): E.Effect<
  AppStateUpdateWorker<ProcessError>,
  never,
  Requirements | Scope.Scope
> {
  return E.gen(function* () {
    const queue = yield* Queue.unbounded<AppStateUpdateRequest<ProcessError>>();

    const processBatch = E.gen(function* () {
      const requests = yield* Queue.takeAll(queue);
      const latestRequest = A.lastNonEmpty(requests);

      const result = yield* E.result(process(latestRequest.state));

      yield* E.forEach(requests, (request) => {
        return Result.match(result, {
          onFailure: (failure) => {
            return Deferred.fail(request.deferred, failure).pipe(E.asVoid);
          },
          onSuccess: () => {
            return Deferred.succeed(request.deferred, undefined).pipe(E.asVoid);
          },
        });
      });
    });

    const processLoop: E.Effect<never, never, Requirements> = E.suspend(() => {
      return processBatch.pipe(E.andThen(processLoop));
    });

    yield* processLoop.pipe(E.tapCause(E.logError), E.forkScoped);

    const set = (state: AppState) => {
      return E.gen(function* () {
        const deferred = yield* Deferred.make<void, ProcessError>();

        yield* Queue.offer(queue, {
          deferred,
          state,
        });

        yield* Deferred.await(deferred);
      });
    };

    return {
      set,
    };
  });
}
