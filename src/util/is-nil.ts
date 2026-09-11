import * as Predicate from "effect/Predicate";

export function isNil(value: unknown) {
  return Predicate.isUndefined(value) || Predicate.isNull(value);
}
