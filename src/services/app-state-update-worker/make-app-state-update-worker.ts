import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import type * as Scope from "effect/Scope";

import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

import { type AppStateUpdateWorkerService } from "./app-state-update-worker-service.ts";

type AppStateUpdateRequest<E> = {
  readonly deferred: Deferred.Deferred<void, E>;
  readonly state: AppState;
};

export function makeAppStateUpdateWorker<E, R>(
  process: (state: AppState) => E.Effect<void, E, R>,
): E.Effect<AppStateUpdateWorkerService, never, R | Scope.Scope> {
  return E.gen(function* () {
    const queue = yield* Queue.unbounded<AppStateUpdateRequest<E>>();

    const processBatch = E.gen(function* () {
      const requests = yield* Queue.takeAll(queue);
      const latestRequest = A.lastNonEmpty(requests);

      const result = yield* E.result(process(latestRequest.state));

      yield* E.forEach(requests, (request) => {
        if (result._tag === "Failure") {
          return Deferred.fail(request.deferred, result.failure).pipe(E.asVoid);
        }

        return Deferred.succeed(request.deferred, undefined).pipe(E.asVoid);
      });
    });

    const processLoop: E.Effect<never, never, R> = E.suspend(() => {
      return processBatch.pipe(E.andThen(processLoop));
    });

    yield* processLoop.pipe(E.tapCause(E.logError), E.forkScoped);

    const submit = (state: AppState) => {
      return E.gen(function* () {
        const deferred = yield* Deferred.make<void, E>();

        yield* Queue.offer(queue, {
          deferred,
          state,
        });

        yield* Deferred.await(deferred);
      });
    };

    return {
      submit,
    };
  });
}
