import { describe, expect, test } from "vitest";

import { FellowshipLogsApiRateLimitExceededError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { type FellowshipLogsApiPointPools } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

import {
  getImportCostEstimateLines,
  getPointPoolItems,
  getPointPoolsBlock,
  getRateLimitExceededMessage,
} from "@/renderer/api/fellowship-logs/fellowship-logs-point-messages.ts";
import { formatLocalTimeFromMilliseconds } from "@/util/format-date-time.ts";

const NOW = 1_000_000;

const TWELVE_MINUTES = 12 * 60 * 1_000;

const USER_RESET = NOW + TWELVE_MINUTES;

const APPLICATION_RESET = NOW + 2 * TWELVE_MINUTES;

type PointPools = NonNullable<FellowshipLogsApiPointPools>;

function makePointPools({
  applicationRemaining = 2400,
  userHasRemainingPoints = true,
}: {
  readonly applicationRemaining?: number;
  readonly userHasRemainingPoints?: boolean | null;
} = {}): PointPools {
  return {
    observedAtMilliseconds: NOW,
    pools: {
      APPLICATION: {
        hasRemainingPoints: applicationRemaining > 0,
        limitPerHour: 3000,
        pointsRemaining: applicationRemaining,
        resetSource: "pointsResetIn",
        resetsAtMilliseconds: APPLICATION_RESET,
      },
      DATABASE: {
        hasRemainingPoints: null,
        limitPerHour: null,
        pointsRemaining: null,
        resetSource: null,
        resetsAtMilliseconds: null,
      },
      USER: {
        hasRemainingPoints: userHasRemainingPoints,
        limitPerHour: null,
        pointsRemaining: null,
        resetSource: "userPointsResetIn",
        resetsAtMilliseconds: USER_RESET,
      },
    },
  };
}

function resetText(resetsAtMilliseconds: number, minutes: number) {
  return `${minutes} minutes, at ${formatLocalTimeFromMilliseconds(resetsAtMilliseconds)}`;
}

describe("getPointPoolItems", () => {
  test("labels each pool by what the recommended profile does with it", () => {
    expect(
      getPointPoolItems(makePointPools(), "FELLOWSHIP_RUN_TRACKER_USER", NOW),
    ).toEqual([
      {
        isWarning: false,
        label: "Your account points",
        note: "Imports use these",
        pool: "USER",
        resets: `Resets in ${resetText(USER_RESET, 12)}`,
        value: "Available",
      },
    ]);
  });

  test("orders the client's points first for an own API client", () => {
    expect(
      getPointPoolItems(makePointPools(), "OWN_CLIENT", NOW).map(
        ({ label, note }) => [label, note],
      ),
    ).toEqual([["API client points", "Imports use these"]]);
  });

  test("says the client's points are the fallback for an own client with sign-in", () => {
    expect(
      getPointPoolItems(makePointPools(), "OWN_CLIENT_USER", NOW).map(
        ({ label, note }) => [label, note],
      ),
    ).toEqual([
      ["Your account points", "Imports use these first"],
      ["API client points", "Used when your account points run out"],
    ]);
  });

  test("flags used-up pools", () => {
    const items = getPointPoolItems(
      makePointPools({
        applicationRemaining: 0,
        userHasRemainingPoints: false,
      }),
      null,
      NOW,
    );

    expect(
      items.map(({ isWarning, label, value }) => [label, value, isWarning]),
    ).toEqual([
      ["Your account points", "Used up", true],
      ["API client points", "0 of 3,000 left", true],
    ]);
  });

  test("treats a pool as refilled once its reset time passes", () => {
    const items = getPointPoolItems(
      makePointPools({
        applicationRemaining: 0,
        userHasRemainingPoints: false,
      }),
      null,
      APPLICATION_RESET,
    );

    expect(
      items.map(({ isWarning, resets, value }) => [value, resets, isWarning]),
    ).toEqual([
      ["Available", null, false],
      ["3,000 of 3,000 left", null, false],
    ]);
  });
});

describe("getPointPoolsBlock", () => {
  test("blocks the recommended profile when the user's points run out", () => {
    expect(
      getPointPoolsBlock(
        makePointPools({ userHasRemainingPoints: false }),
        "FELLOWSHIP_RUN_TRACKER_USER",
        NOW,
      ),
    ).toEqual({
      lookupMessage: `You're out of your account points. Points reset in ${resetText(USER_RESET, 12)}.`,
      queueNotice: `You're out of your account points. This import will start when points reset in ${resetText(USER_RESET, 12)}.`,
    });
  });

  test("explains when the recommended connection is temporarily limited", () => {
    expect(
      getPointPoolsBlock(
        makePointPools({ applicationRemaining: 0.5 }),
        "FELLOWSHIP_RUN_TRACKER_USER",
        NOW,
      )?.lookupMessage,
    ).toBe(
      `Fellowship Logs is temporarily limiting this connection. Points reset in ${resetText(APPLICATION_RESET, 24)}.`,
    );
  });

  test("ignores the user's points for an own API client", () => {
    expect(
      getPointPoolsBlock(
        makePointPools({ userHasRemainingPoints: false }),
        "OWN_CLIENT",
        NOW,
      ),
    ).toBe(undefined);
  });

  test("blocks an own client with sign-in only when both pools are empty, until the first reset", () => {
    expect(
      getPointPoolsBlock(
        makePointPools({ userHasRemainingPoints: false }),
        "OWN_CLIENT_USER",
        NOW,
      ),
    ).toBe(undefined);
    expect(
      getPointPoolsBlock(
        makePointPools({
          applicationRemaining: 0,
          userHasRemainingPoints: false,
        }),
        "OWN_CLIENT_USER",
        NOW,
      )?.lookupMessage,
    ).toBe(
      `Your account and API client are out of points. Points reset in ${resetText(USER_RESET, 12)}.`,
    );
  });

  test("lifts the block once the reset time passes", () => {
    expect(
      getPointPoolsBlock(
        makePointPools({ userHasRemainingPoints: false }),
        "FELLOWSHIP_RUN_TRACKER_USER",
        USER_RESET,
      ),
    ).toBe(undefined);
  });

  test("does not block without pool data or a connection", () => {
    expect(getPointPoolsBlock(null, "FELLOWSHIP_RUN_TRACKER_USER", NOW)).toBe(
      undefined,
    );
    expect(
      getPointPoolsBlock(
        makePointPools({ userHasRemainingPoints: false }),
        undefined,
        NOW,
      ),
    ).toBe(undefined);
  });
});

describe("getRateLimitExceededMessage", () => {
  test("names the empty pool and when it resets", () => {
    expect(
      getRateLimitExceededMessage(
        new FellowshipLogsApiRateLimitExceededError({
          reason: "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
          resetsAtMilliseconds: USER_RESET,
        }),
        NOW,
      ),
    ).toBe(
      `Fellowship Logs is temporarily limiting this connection. Points reset in ${resetText(USER_RESET, 12)}.`,
    );
  });

  test("is undefined for other errors", () => {
    expect(getRateLimitExceededMessage(new Error("fetch failed"), NOW)).toBe(
      undefined,
    );
  });
});

describe("getImportCostEstimateLines", () => {
  test("asks for a connection when there's no estimate", () => {
    expect(getImportCostEstimateLines(null)).toEqual({
      latest: "Connect to Fellowship Logs to see what your imports cost.",
      range: null,
    });
  });

  test("waits for the first import and the comparable samples", () => {
    expect(getImportCostEstimateLines({ latest: null, range: null })).toEqual({
      latest: "Your first import will show its exact cost here.",
      range: "A personal range appears after 10 comparable imports.",
    });
  });

  test("reports the exact latest cost with its split and the personal range", () => {
    expect(
      getImportCostEstimateLines({
        latest: {
          applicationPoints: 12,
          completedAtMilliseconds: NOW,
          isFullyCached: false,
          totalPoints: 1234.4,
          userPoints: 1222.4,
        },
        range: { highPoints: 60, lowPoints: 30, sampleCount: 14 },
      }),
    ).toEqual({
      latest:
        "Your last import cost 1,234 points, including the lookup. That was 1,222 account points and 12 API client points.",
      range:
        "Imports like yours usually cost 30–60 points, based on 14 of your imports.",
    });
  });

  test("says a cached import used no points", () => {
    expect(
      getImportCostEstimateLines({
        latest: {
          applicationPoints: 0,
          completedAtMilliseconds: NOW,
          isFullyCached: true,
          totalPoints: 0,
          userPoints: 0,
        },
        range: null,
      }).latest,
    ).toBe(
      "Your last import used no points because its report was already cached.",
    );
  });
});
