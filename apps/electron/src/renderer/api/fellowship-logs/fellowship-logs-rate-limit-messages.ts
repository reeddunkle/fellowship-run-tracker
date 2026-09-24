import * as Schema from "effect/Schema";

import { FellowshipLogsApiRateLimitExceededError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { type FellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import { formatMinutesUntil } from "@/util/format-date-time.ts";

const PointsFormatter = new Intl.NumberFormat("en-US");

export function getOutOfPointsMessage(
  { limitPerHour, resetsAtMilliseconds }: FellowshipLogsRateLimitStatus,
  nowMilliseconds: number,
): string {
  return `You've used all ${PointsFormatter.format(limitPerHour)} Fellowship Logs points for this hour. They reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

export function getRateLimitExceededMessage(
  resetsAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `You're out of Fellowship Logs points. They reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

export function getQueueWhileOutOfPointsMessage(
  resetsAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `You're out of Fellowship Logs points, so this import will start when they reset in ${formatMinutesUntil(resetsAtMilliseconds, nowMilliseconds)}.`;
}

export function getWaitingImportMessage(
  availableAtMilliseconds: number | null,
  nowMilliseconds: number,
): string {
  return availableAtMilliseconds === null ||
    availableAtMilliseconds <= nowMilliseconds
    ? "Out of Fellowship Logs points. Resuming shortly."
    : `Out of Fellowship Logs points. Resumes in ${formatMinutesUntil(availableAtMilliseconds, nowMilliseconds)}.`;
}

export const WAITING_FOR_POINTS_MESSAGE =
  "Waiting for Fellowship Logs points to reset.";

const isRateLimitExceededError = Schema.is(
  FellowshipLogsApiRateLimitExceededError,
);

export function getRateLimitExceededResetsAt(
  error: unknown,
): number | undefined {
  return isRateLimitExceededError(error)
    ? error.resetsAtMilliseconds
    : undefined;
}

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
