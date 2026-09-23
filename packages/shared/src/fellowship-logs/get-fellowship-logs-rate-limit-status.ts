import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";

export type FellowshipLogsRateLimitStatus = {
  /** True when no points are left and the reset hasn't happened yet. */
  readonly isExhausted: boolean;
  /**
   * True when the snapshot's reset time has passed, so its numbers are
   * assumed rather than observed.
   */
  readonly isStale: boolean;
  readonly limitPerHour: number;
  readonly pointsRemaining: number;
  readonly resetsAtMilliseconds: number;
};

/**
 * Interprets a rate-limit snapshot at `nowMilliseconds`. Once the snapshot's
 * reset time has passed, the full hourly limit is assumed to be available
 * again.
 */
export function getFellowshipLogsRateLimitStatus(
  snapshot: FellowshipLogsRateLimitSnapshot,
  nowMilliseconds: number,
): FellowshipLogsRateLimitStatus {
  const resetsAtMilliseconds =
    snapshot.observedAtMilliseconds + snapshot.pointsResetIn * 1_000;

  if (nowMilliseconds >= resetsAtMilliseconds) {
    return {
      isExhausted: false,
      isStale: true,
      limitPerHour: snapshot.limitPerHour,
      pointsRemaining: snapshot.limitPerHour,
      resetsAtMilliseconds,
    };
  }

  const pointsRemaining = Math.max(
    snapshot.limitPerHour - snapshot.pointsSpentThisHour,
    0,
  );

  return {
    isExhausted: pointsRemaining <= 0,
    isStale: false,
    limitPerHour: snapshot.limitPerHour,
    pointsRemaining,
    resetsAtMilliseconds,
  };
}
