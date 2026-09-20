import { describe, expect, test } from "vitest";

import { getMean } from "@/util/statistics/get-mean.ts";
import { getMedian } from "@/util/statistics/get-median.ts";
import { getMinimum } from "@/util/statistics/get-minimum.ts";

describe("getMean", () => {
  test("returns the average of the values", () => {
    expect(getMean([10, 20, 30])).toBe(20);
  });

  test("returns 0 for an empty array", () => {
    expect(getMean([])).toBe(0);
  });
});

describe("getMedian", () => {
  test("returns the middle value for an odd-length array", () => {
    expect(getMedian([30, 10, 20])).toBe(20);
  });

  test("averages the two middle values for an even-length array", () => {
    expect(getMedian([10, 20, 30, 40])).toBe(25);
  });

  test("returns 0 for an empty array", () => {
    expect(getMedian([])).toBe(0);
  });
});

describe("getMinimum", () => {
  test("returns the smallest value", () => {
    expect(getMinimum([30, 10, 20])).toBe(10);
  });

  test("returns 0 for an empty array", () => {
    expect(getMinimum([])).toBe(0);
  });
});
