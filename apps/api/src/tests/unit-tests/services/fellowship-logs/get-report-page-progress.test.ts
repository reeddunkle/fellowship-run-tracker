import { describe, expect, test } from "vitest";

import { getReportPageProgress } from "@frt/api/services/fellowship-logs/fellowship-logs-response-helpers.ts";

describe("getReportPageProgress", () => {
  test("is the share of the fight covered up to the next page", () => {
    expect(
      getReportPageProgress({
        endTime: 2000,
        nextPageTimestamp: 1500,
        startTime: 1000,
      }),
    ).toBe(0.5);
  });

  test("is complete once there's no next page", () => {
    expect(
      getReportPageProgress({
        endTime: 2000,
        nextPageTimestamp: null,
        startTime: 1000,
      }),
    ).toBe(1);
  });

  test("stays between 0 and 1", () => {
    expect(
      getReportPageProgress({
        endTime: 2000,
        nextPageTimestamp: 500,
        startTime: 1000,
      }),
    ).toBe(0);
    expect(
      getReportPageProgress({
        endTime: 2000,
        nextPageTimestamp: 2500,
        startTime: 1000,
      }),
    ).toBe(1);
  });

  test("treats a zero-length fight as complete", () => {
    expect(
      getReportPageProgress({
        endTime: 1000,
        nextPageTimestamp: 1000,
        startTime: 1000,
      }),
    ).toBe(1);
  });
});
