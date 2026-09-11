import * as E from "effect/Effect";

import { NoopLoggerLayer } from "@/tests/common/layers/noop-logger-layer.ts";

export function runTest<A, Error>(effect: E.Effect<A, Error>): Promise<A> {
  return E.runPromise(effect.pipe(E.provide(NoopLoggerLayer)));
}

// export function runTestWithLogs<A, Error>(
//   effect: E.Effect<A, Error>,
// ): Promise<A> {
//   return E.runPromise(effect);
// }
