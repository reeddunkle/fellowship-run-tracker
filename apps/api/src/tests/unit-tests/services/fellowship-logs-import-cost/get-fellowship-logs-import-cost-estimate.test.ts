import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import { FELLOWSHIP_LOGS_POINT_POLICY_VERSION } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { type FellowshipLogsImportCostObservation } from "@frt/shared/fellowship-logs/fellowship-logs-import-cost-schema.ts";
import { getFellowshipLogsImportCostEstimate } from "@frt/shared/fellowship-logs/get-fellowship-logs-import-cost-estimate.ts";
import { getFellowshipLogsRequestCost } from "@frt/shared/fellowship-logs/get-fellowship-logs-request-cost.ts";

const OPTIONS = {
  includesLookup: true,
  pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  profile: "FELLOWSHIP_RUN_TRACKER_USER",
} as const;

function makeObservation(
  overrides: Partial<FellowshipLogsImportCostObservation> = {},
): FellowshipLogsImportCostObservation {
  return {
    apiRequestCount: 3,
    applicationPoints: 0,
    cacheHitCount: 0,
    completedAtMilliseconds: 1_000,
    followsProfileChange: false,
    includesLookup: true,
    isResumed: false,
    outcome: "SUCCEEDED",
    pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
    profile: "FELLOWSHIP_RUN_TRACKER_USER",
    totalPoints: 13,
    unmeasuredRequestCount: 0,
    userPoints: 13,
    ...overrides,
  };
}

function makeSamples(points: ReadonlyArray<number>) {
  return points.map((totalPoints, index) => {
    return makeObservation({
      completedAtMilliseconds: 1_000 + index,
      totalPoints,
      userPoints: totalPoints,
    });
  });
}

describe("getFellowshipLogsRequestCost", () => {
  test("reads the provider's per-request point split", () => {
    expect(
      getFellowshipLogsRequestCost({ application: 0, total: 4, user: 4 }),
    ).toEqual(Option.some({ application: 0, total: 4, user: 4 }));
  });

  test("derives user points when the provider omits them", () => {
    expect(getFellowshipLogsRequestCost({ application: 0, total: 1 })).toEqual(
      Option.some({ application: 0, total: 1, user: 1 }),
    );
  });

  test("keeps fractional user spending", () => {
    expect(
      getFellowshipLogsRequestCost({ application: 0, total: 6.68, user: 6.68 }),
    ).toEqual(Option.some({ application: 0, total: 6.68, user: 6.68 }));
  });

  test("ignores a missing or inconsistent split", () => {
    expect(getFellowshipLogsRequestCost(undefined)).toEqual(Option.none());
    expect(getFellowshipLogsRequestCost({ total: 4 })).toEqual(Option.none());
    expect(getFellowshipLogsRequestCost({ application: 5, total: 4 })).toEqual(
      Option.none(),
    );
  });
});

describe("getFellowshipLogsImportCostEstimate", () => {
  test("reports nothing before an import completes", () => {
    expect(
      getFellowshipLogsImportCostEstimate(
        [makeObservation({ outcome: "FAILED" })],
        OPTIONS,
      ),
    ).toEqual({ latest: null, range: null });
  });

  test("shows the exact cost of the latest completed import", () => {
    const estimate = getFellowshipLogsImportCostEstimate(
      [
        makeObservation({ completedAtMilliseconds: 1_000, totalPoints: 13 }),
        makeObservation({
          applicationPoints: 0,
          completedAtMilliseconds: 2_000,
          totalPoints: 9,
          userPoints: 9,
        }),
      ],
      OPTIONS,
    );

    expect(estimate.latest).toEqual({
      applicationPoints: 0,
      completedAtMilliseconds: 2_000,
      isFullyCached: false,
      totalPoints: 9,
      userPoints: 9,
    });
    expect(estimate.range).toBeNull();
  });

  test("reports a fully cached import as zero points", () => {
    const estimate = getFellowshipLogsImportCostEstimate(
      [
        makeObservation({
          apiRequestCount: 0,
          cacheHitCount: 3,
          totalPoints: 0,
          userPoints: 0,
        }),
      ],
      OPTIONS,
    );

    expect(estimate.latest).toMatchObject({
      isFullyCached: true,
      totalPoints: 0,
    });
  });

  test("ignores imports whose cost was not measured exactly", () => {
    expect(
      getFellowshipLogsImportCostEstimate(
        [makeObservation({ unmeasuredRequestCount: 1 })],
        OPTIONS,
      ).latest,
    ).toBeNull();
  });

  test("ignores imports that resumed after a profile change", () => {
    expect(
      getFellowshipLogsImportCostEstimate(
        [makeObservation({ followsProfileChange: true, isResumed: true })],
        OPTIONS,
      ).latest,
    ).toBeNull();
  });

  test("waits for ten comparable samples before showing a range", () => {
    expect(
      getFellowshipLogsImportCostEstimate(
        makeSamples([10, 11, 12, 13, 14, 15, 16, 17, 18]),
        OPTIONS,
      ).range,
    ).toBeNull();
  });

  test("bounds the range by the 10th and 90th percentile samples", () => {
    expect(
      getFellowshipLogsImportCostEstimate(
        makeSamples([40, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1]),
        OPTIONS,
      ).range,
    ).toEqual({ highPoints: 18, lowPoints: 10, sampleCount: 11 });
  });

  test("keeps incomparable imports out of the range", () => {
    const comparable = makeSamples([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    const incomparable = [
      makeObservation({ outcome: "FAILED", totalPoints: 99 }),
      makeObservation({ outcome: "CANCELLED", totalPoints: 99 }),
      makeObservation({ outcome: "DEFERRED", totalPoints: 99 }),
      makeObservation({ isResumed: true, totalPoints: 99 }),
      makeObservation({
        followsProfileChange: true,
        isResumed: true,
        totalPoints: 99,
      }),
      makeObservation({ cacheHitCount: 1, totalPoints: 99 }),
      makeObservation({ pointPolicyVersion: "older", totalPoints: 99 }),
      makeObservation({ profile: "OWN_CLIENT_USER", totalPoints: 99 }),
      makeObservation({ profile: null, totalPoints: 99 }),
      makeObservation({ includesLookup: false, totalPoints: 99 }),
      makeObservation({ totalPoints: 99, unmeasuredRequestCount: 1 }),
    ];

    expect(
      getFellowshipLogsImportCostEstimate(
        [...comparable, ...incomparable],
        OPTIONS,
      ).range,
    ).toBeNull();
  });
});
