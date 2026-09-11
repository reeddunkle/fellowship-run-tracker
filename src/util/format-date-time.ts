import { formatDistanceToNow } from "date-fns";
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

export function formatRelativeDateTime(dateTime: DateTime.Utc): string {
  return formatDistanceToNow(toDate(dateTime), {
    addSuffix: true,
  });
}
