import * as Option from "effect/Option";

export function getSome<T>(option: Option.Option<T>): T {
  if (Option.isNone(option)) {
    throw new Error("Expected a value.");
  }

  return option.value;
}
