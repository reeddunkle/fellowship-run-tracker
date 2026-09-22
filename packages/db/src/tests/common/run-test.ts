import * as E from "effect/Effect";
import * as Logger from "effect/Logger";

const NoopLoggerLayer = Logger.layer([]);

export function runTest<A, Error>(effect: E.Effect<A, Error>): Promise<A> {
  return E.runPromise(effect.pipe(E.provide(NoopLoggerLayer)));
}
