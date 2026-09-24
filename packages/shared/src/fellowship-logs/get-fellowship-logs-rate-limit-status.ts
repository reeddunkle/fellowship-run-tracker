import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";

export type FellowshipLogsRateLimitStatus = {
  readonly isExhausted: boolean;
  readonly isStale: boolean;
  readonly limitPerHour: number;
  readonly pointsRemaining: number;
  readonly resetsAtMilliseconds: number;
};

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
