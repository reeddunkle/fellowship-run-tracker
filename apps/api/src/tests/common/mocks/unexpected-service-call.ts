import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

export function unexpectedEffectCall(service: string, method: string) {
  return () => E.die(`unexpected call: ${service}.${method}`);
}

export function unexpectedStreamCall(service: string, method: string) {
  return Stream.die(`unexpected call: ${service}.${method}`);
}
