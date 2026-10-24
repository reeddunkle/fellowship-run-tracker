import { describe, expect, test } from "vitest";

import { createFellowshipLogsRateLimitDataApiResponse } from "@frt/api/services/fellowship-logs/create-fellowship-logs-api-response.ts";
import { FELLOWSHIP_LOGS_BETA_POINT_POLICY } from "@frt/shared/fellowship-logs/fellowship-logs-beta-point-policy.ts";
import { FELLOWSHIP_LOGS_POINT_POLICY_VERSION } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { getFellowshipLogsPointPools } from "@frt/shared/fellowship-logs/get-fellowship-logs-point-pools.ts";

const OBSERVED_AT = 1_000_000;

const SNAPSHOT = {
  databaseLimitPerHour: 250,
  databasePointsSpentThisHour: 40,
  limitPerHour: 3600,
  observedAtMilliseconds: OBSERVED_AT,
  pointsResetIn: 600,
  pointsSpentThisHour: 100,
  userHasRemainingPoints: false,
  userPointsResetIn: 120,
};

describe("getFellowshipLogsPointPools", () => {
  test("keeps each pool's remaining points and its own reset", () => {
    expect(getFellowshipLogsPointPools(SNAPSHOT, OBSERVED_AT)).toEqual({
      APPLICATION: {
        hasRemainingPoints: true,
        limitPerHour: 3600,
        pointsRemaining: 3500,
        pool: "APPLICATION",
        resetSource: "pointsResetIn",
        resetsAtMilliseconds: OBSERVED_AT + 600_000,
      },
      DATABASE: {
        hasRemainingPoints: true,
        limitPerHour: 250,
        pointsRemaining: 210,
        pool: "DATABASE",
        resetSource: "pointsResetIn",
        resetsAtMilliseconds: OBSERVED_AT + 600_000,
      },
      USER: {
        hasRemainingPoints: false,
        limitPerHour: null,
        pointsRemaining: null,
        pool: "USER",
        resetSource: "userPointsResetIn",
        resetsAtMilliseconds: OBSERVED_AT + 120_000,
      },
    });
  });

  test("stops reporting exhausted user points once their reset passes", () => {
    const pools = getFellowshipLogsPointPools(SNAPSHOT, OBSERVED_AT + 120_000);

    expect(pools.USER.hasRemainingPoints).toBeNull();
    expect(pools.APPLICATION.pointsRemaining).toBe(3500);
  });

  test("refills a metered pool once its reset passes", () => {
    const pools = getFellowshipLogsPointPools(SNAPSHOT, OBSERVED_AT + 600_000);

    expect(pools.APPLICATION.pointsRemaining).toBe(3600);
    expect(pools.DATABASE.pointsRemaining).toBe(250);
  });

  test("reports unknown pools when the provider omits them", () => {
    const pools = getFellowshipLogsPointPools(
      {
        limitPerHour: 3600,
        observedAtMilliseconds: OBSERVED_AT,
        pointsResetIn: 600,
        pointsSpentThisHour: 100,
      },
      OBSERVED_AT,
    );

    expect(pools.DATABASE).toMatchObject({
      hasRemainingPoints: null,
      pointsRemaining: null,
      resetsAtMilliseconds: null,
    });
    expect(pools.USER).toMatchObject({
      hasRemainingPoints: null,
      resetsAtMilliseconds: null,
    });
  });
});

describe("createFellowshipLogsRateLimitDataApiResponse", () => {
  test("keeps the renderer contract to the application pool", () => {
    expect(createFellowshipLogsRateLimitDataApiResponse(SNAPSHOT)).toEqual({
      limitPerHour: 3600,
      observedAtMilliseconds: OBSERVED_AT,
      pointsResetIn: 600,
      pointsSpentThisHour: 100,
    });
  });
});

describe("FELLOWSHIP_LOGS_BETA_POINT_POLICY", () => {
  test("belongs to the current point-policy version", () => {
    expect(FELLOWSHIP_LOGS_BETA_POINT_POLICY.version).toBe(
      FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
    );
    expect(
      FELLOWSHIP_LOGS_BETA_POINT_POLICY.limitsPerHour.UNSUBSCRIBED,
    ).toEqual({ APPLICATION: 1000, DATABASE: 250, USER: 100 });
  });
});
