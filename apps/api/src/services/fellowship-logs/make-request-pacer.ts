import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

export function makeRequestPacer(minInterval: Duration.Input) {
  return E.gen(function* () {
    const minIntervalMilliseconds = Duration.toMillis(minInterval);
    const semaphore = yield* Semaphore.make(1);
    const lastFinishedAtRef = yield* Ref.make<number | null>(null);

    const markFinished = Clock.currentTimeMillis.pipe(
      E.flatMap((nowMilliseconds) => {
        return Ref.set(lastFinishedAtRef, nowMilliseconds);
      }),
    );

    return function pace<A, Err, R>(
      effect: E.Effect<A, Err, R>,
    ): E.Effect<A, Err, R> {
      return semaphore.withPermit(
        E.gen(function* () {
          const lastFinishedAt = yield* Ref.get(lastFinishedAtRef);

          if (lastFinishedAt !== null) {
            const nowMilliseconds = yield* Clock.currentTimeMillis;
            const waitMilliseconds =
              lastFinishedAt + minIntervalMilliseconds - nowMilliseconds;

            if (waitMilliseconds > 0) {
              yield* E.sleep(Duration.millis(waitMilliseconds));
            }
          }

          return yield* effect.pipe(E.ensuring(markFinished));
        }),
      );
    };
  });
}
