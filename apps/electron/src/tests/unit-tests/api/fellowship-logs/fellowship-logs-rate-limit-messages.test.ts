import { describe, expect, test } from "vitest";

import { FellowshipLogsApiRateLimitExceededError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { getFellowshipLogsRateLimitStatus } from "@frt/shared/fellowship-logs/get-fellowship-logs-rate-limit-status.ts";

import {
  getOutOfPointsMessage,
  getQueueWhileOutOfPointsMessage,
  getRateLimitDataItems,
  getRateLimitExceededResetsAt,
  getRateLimitRefreshErrorMessage,
  getWaitingImportMessage,
} from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";

const NOW = 1_000_000;

const TWELVE_MINUTES = 12 * 60 * 1_000;

function makeStatus(pointsSpentThisHour: number) {
  return getFellowshipLogsRateLimitStatus(
    {
      limitPerHour: 3600,
      observedAtMilliseconds: NOW,
      pointsResetIn: 12 * 60,
      pointsSpentThisHour,
    },
    NOW,
  );
}

describe("getOutOfPointsMessage", () => {
  test("names the limit and when the points reset", () => {
    expect(getOutOfPointsMessage(makeStatus(3600), NOW)).toBe(
      "You've used all 3,600 Fellowship Logs points for this hour. They reset in 12 minutes.",
    );
  });

  test("rounds a partial minute up", () => {
    expect(getOutOfPointsMessage(makeStatus(3600), NOW + 30_000)).toBe(
      "You've used all 3,600 Fellowship Logs points for this hour. They reset in 12 minutes.",
    );
  });
});

describe("getQueueWhileOutOfPointsMessage", () => {
  test("says the import will wait for the reset", () => {
    expect(getQueueWhileOutOfPointsMessage(NOW + TWELVE_MINUTES, NOW)).toBe(
      "You're out of Fellowship Logs points, so this import will start when they reset in 12 minutes.",
    );
  });
});

describe("getWaitingImportMessage", () => {
  test("says when a waiting import resumes", () => {
    expect(getWaitingImportMessage(NOW + 60_000, NOW)).toBe(
      "Out of Fellowship Logs points. Resumes in 1 minute.",
    );
  });

  test("says it's resuming once the time has passed", () => {
    expect(getWaitingImportMessage(NOW - 1, NOW)).toBe(
      "Out of Fellowship Logs points. Resuming shortly.",
    );
  });
});

describe("getRateLimitExceededResetsAt", () => {
  test("reads the reset time from a rate-limit error", () => {
    expect(
      getRateLimitExceededResetsAt(
        new FellowshipLogsApiRateLimitExceededError({
          resetsAtMilliseconds: NOW,
        }),
      ),
    ).toBe(NOW);
  });

  test("is undefined for other errors", () => {
    expect(getRateLimitExceededResetsAt(new Error("fetch failed"))).toBe(
      undefined,
    );
  });
});

describe("getRateLimitRefreshErrorMessage", () => {
  test("explains an exhausted limit", () => {
    expect(
      getRateLimitRefreshErrorMessage(
        new FellowshipLogsApiRateLimitExceededError({
          resetsAtMilliseconds: NOW + TWELVE_MINUTES,
        }),
        NOW,
      ),
    ).toBe("You're out of Fellowship Logs points. They reset in 12 minutes.");
  });

  test("falls back to a connection failure", () => {
    expect(getRateLimitRefreshErrorMessage(new Error("boom"), NOW)).toBe(
      "Failed to connect to Fellowship Logs.",
    );
  });
});

describe("getRateLimitDataItems", () => {
  test("shows the points left, the limit, and the reset countdown", () => {
    expect(getRateLimitDataItems(makeStatus(1200.5), NOW)).toEqual([
      { isWarning: false, label: "Points left", value: "2,399" },
      { isWarning: false, label: "Hourly limit", value: "3,600" },
      { isWarning: false, label: "Resets in", value: "12 minutes" },
    ]);
  });

  test("flags the points left once they're used up", () => {
    expect(getRateLimitDataItems(makeStatus(3600), NOW)[0]).toEqual({
      isWarning: true,
      label: "Points left",
      value: "0",
    });
  });

  test("shows the full limit once the reset time has passed", () => {
    const status = getFellowshipLogsRateLimitStatus(
      {
        limitPerHour: 3600,
        observedAtMilliseconds: NOW,
        pointsResetIn: 60,
        pointsSpentThisHour: 3600,
      },
      NOW + 60_000,
    );

    expect(getRateLimitDataItems(status, NOW + 60_000)).toEqual([
      { isWarning: false, label: "Points left", value: "3,600" },
      { isWarning: false, label: "Hourly limit", value: "3,600" },
      { isWarning: false, label: "Resets in", value: "—" },
    ]);
  });
});
