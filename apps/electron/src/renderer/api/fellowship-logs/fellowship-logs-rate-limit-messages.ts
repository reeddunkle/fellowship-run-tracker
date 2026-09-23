import * as Schema from "effect/Schema";

import { FellowshipLogsApiRateLimitExceededError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { type FellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import { formatMinutesUntil } from "@/util/format-date-time.ts";

const PointsFormatter = new Intl.NumberFormat("en-US");

/** Shown when a lookup is blocked because the hour's points are used up. */
export function getOutOfPointsMessage(
  { limitPerHour, resetsAtMilliseconds }: FellowshipLogsRateLimitStatus,
  nowMilliseconds: number,
): string {
  return `You've used all ${PointsFormatter.format(limitPerHour)} Fellowship Logs points for this hour. They reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

/** Shown when a request was turned away for being over the limit. */
export function getRateLimitExceededMessage(
  resetsAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `You're out of Fellowship Logs points. They reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

/** Shown when queueing an import while out of points. */
export function getQueueWhileOutOfPointsMessage(
  resetsAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `You're out of Fellowship Logs points, so this import will start when they reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

/** Status line for an import that's waiting for points to reset. */
export function getWaitingImportMessage(
  availableAtMilliseconds: number | null,
  nowMilliseconds: number,
): string {
  return availableAtMilliseconds === null ||
    availableAtMilliseconds <= nowMilliseconds
    ? "Out of Fellowship Logs points. Resuming shortly."
    : `Out of Fellowship Logs points. Resumes in ${formatMinutesUntil(availableAtMilliseconds, nowMilliseconds)}.`;
}

/** Status line for queued imports held up behind a waiting one. */
export const WAITING_FOR_POINTS_MESSAGE =
  "Waiting for Fellowship Logs points to reset.";

const isRateLimitExceededError = Schema.is(
  FellowshipLogsApiRateLimitExceededError,
);

/**
 * When the points reset, if `error` is Fellowship Logs turning a request
 * away for being over the limit.
 */
export function getRateLimitExceededResetsAt(
  error: unknown,
): number | undefined {
  return isRateLimitExceededError(error)
    ? error.resetsAtMilliseconds
    : undefined;
}

/** Message for a failed rate-limit lookup (e.g. "Test connection"). */
export function getRateLimitRefreshErrorMessage(
  error: unknown,
  nowMilliseconds: number,
): string {
  const resetsAtMilliseconds = getRateLimitExceededResetsAt(error);

  return resetsAtMilliseconds === undefined
    ? "Failed to connect to Fellowship Logs."
    : getRateLimitExceededMessage(resetsAtMilliseconds, nowMilliseconds);
}

type RateLimitDataItem = {
  readonly isWarning: boolean;
  readonly label: string;
  readonly value: string;
};

/** The rate-limit figures shown to the user, in display order. */
export function getRateLimitDataItems(
  status: FellowshipLogsRateLimitStatus,
  nowMilliseconds: number,
): ReadonlyArray<RateLimitDataItem> {
  return [
    {
      isWarning: status.isExhausted,
      label: "Points left",
      value: PointsFormatter.format(Math.floor(status.pointsRemaining)),
    },
    {
      isWarning: false,
      label: "Hourly limit",
      value: PointsFormatter.format(status.limitPerHour),
    },
    {
      isWarning: false,
      label: "Resets in",
      value: status.isStale
        ? "—"
        : formatMinutesUntil(status.resetsAtMilliseconds, nowMilliseconds),
    },
  ];
}
