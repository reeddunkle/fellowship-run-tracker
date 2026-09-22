import * as Option from "effect/Option";

export function getDateEpochMilliseconds(date: Option.Option<Date>): number {
  return Option.match(date, {
    onNone: () => 0,
    onSome: (value) => value.getTime(),
  });
}
