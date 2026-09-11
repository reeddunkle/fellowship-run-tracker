import * as DateTime from "effect/DateTime";

export function getElapsedMilliseconds(
  startTime: DateTime.Utc,
  endTime: DateTime.Utc,
): number {
  return DateTime.toEpochMillis(endTime) - DateTime.toEpochMillis(startTime);
}
