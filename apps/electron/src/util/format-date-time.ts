import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import * as DateTime from "effect/DateTime";

const LocalDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

function toDate(dateTime: DateTime.Utc): Date {
  // @effect-diagnostics-next-line globalDate:off
  return new Date(DateTime.toEpochMillis(dateTime));
}

export function formatLocalDateTime(dateTime: DateTime.Utc): string {
  return LocalDateTimeFormatter.format(toDate(dateTime));
}

export function formatRelativeDateTimeFromMilliseconds(
  milliseconds: number,
): string {
  return formatDistanceToNow(milliseconds, {
    addSuffix: true,
  });
}

export function formatRelativeDateTime(dateTime: DateTime.Utc): string {
  return dateTime.pipe(
    DateTime.toEpochMillis,
    formatRelativeDateTimeFromMilliseconds,
  );
}

/**
 * Minutes from `nowMilliseconds` until `targetMilliseconds`, rounded up, e.g.
 * "12 minutes". Suited to waits of up to an hour or so.
 */
export function formatMinutesUntil(
  targetMilliseconds: number,
  nowMilliseconds: number,
): string {
  return formatDistanceStrict(
    Math.max(targetMilliseconds, nowMilliseconds),
    nowMilliseconds,
    { roundingMethod: "ceil", unit: "minute" },
  );
}
