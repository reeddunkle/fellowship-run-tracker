import { describe, expect, test } from "vitest";

import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

const OBSERVED_AT = 1_000_000;

const SNAPSHOT = {
  limitPerHour: 3600,
  observedAtMilliseconds: OBSERVED_AT,
  pointsResetIn: 600,
  pointsSpentThisHour: 3000,
};

const RESETS_AT = OBSERVED_AT + 600_000;

describe("getFellowshipLogsRateLimitStatus", () => {
  test("reports the points left and when they reset", () => {
    expect(getFellowshipLogsRateLimitStatus(SNAPSHOT, OBSERVED_AT)).toEqual({
      isExhausted: false,
      isStale: false,
      limitPerHour: 3600,
      pointsRemaining: 600,
      resetsAtMilliseconds: RESETS_AT,
    });
  });

  test("is exhausted when every point is spent", () => {
    const status = getFellowshipLogsRateLimitStatus(
      { ...SNAPSHOT, pointsSpentThisHour: 3600 },
      OBSERVED_AT + 1_000,
    );

    expect(status.isExhausted).toBe(true);
    expect(status.pointsRemaining).toBe(0);
  });

  test("never reports negative points", () => {
    const status = getFellowshipLogsRateLimitStatus(
      { ...SNAPSHOT, pointsSpentThisHour: 3700 },
      OBSERVED_AT,
    );

    expect(status.pointsRemaining).toBe(0);
    expect(status.isExhausted).toBe(true);
  });

  test("is still exhausted just before the reset", () => {
    const status = getFellowshipLogsRateLimitStatus(
      { ...SNAPSHOT, pointsSpentThisHour: 3600 },
      RESETS_AT - 1,
    );

    expect(status.isExhausted).toBe(true);
    expect(status.isStale).toBe(false);
  });

  test("assumes the full limit is back once the reset time passes", () => {
    expect(
      getFellowshipLogsRateLimitStatus(
        { ...SNAPSHOT, pointsSpentThisHour: 3600 },
        RESETS_AT,
      ),
    ).toEqual({
      isExhausted: false,
      isStale: true,
      limitPerHour: 3600,
      pointsRemaining: 3600,
      resetsAtMilliseconds: RESETS_AT,
    });
  });
});
