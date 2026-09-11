import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  ComparisonTimeFormSchema,
  decodeComparisonTime,
  encodeComparisonTime,
  parseColonTime,
  parseDecimalMinutes,
} from "@/validation/milestone/comparison-time-form-schema.ts";

const decodeComparisonTimeResult = Schema.decodeUnknownResult(
  ComparisonTimeFormSchema,
);

describe("parseColonTime", () => {
  test.each([
    ["0:00", 0],
    ["0:01", 1_000],
    ["1:00", 60_000],
    ["1:23", 83_000],
    ["1:23.1", 83_100],
    ["1:23.12", 83_120],
    ["1:23.123", 83_123],
    ["10:59.999", 659_999],
    ["123:45.678", 7_425_678],
  ])("parses %j to %j", (value, expected) => {
    expect(parseColonTime(value)).toBe(expected);
  });

  test.each([
    "",
    "1:",
    ":01",
    "1:1",
    "1:60",
    "1:99",
    "1:23.",
    "1:23.1234",
    "1:23.abc",
    "-1:00",
    "abc",
    " 1:23",
    "1:23 ",
  ])("rejects %j", (value) => {
    expect(parseColonTime(value)).toBeUndefined();
  });
});

describe("parseDecimalMinutes", () => {
  test.each([
    ["0", 0],
    ["1", 60_000],
    ["1.25", 75_000],
    ["1.5", 90_000],
    ["0.5", 30_000],
    ["2.125", 127_500],
    ["10.001", 600_060],
  ])("parses %j to %j", (value, expected) => {
    expect(parseDecimalMinutes(value)).toBe(expected);
  });

  test.each([
    "",
    ".5",
    "1.",
    "1:00",
    "-1",
    "-1.25",
    "abc",
    "1.2.3",
    " 1",
    "1 ",
  ])("rejects %j", (value) => {
    expect(parseDecimalMinutes(value)).toBeUndefined();
  });

  test("rounds fractional milliseconds", () => {
    expect(parseDecimalMinutes("1.333333")).toBe(80_000);
  });
});

describe("ComparisonTimeFormSchema", () => {
  describe("decode", () => {
    test.each([
      ["", null],
      ["0", 0],
      ["1", 60_000],
      ["1.25", 75_000],
      ["1.5", 90_000],
      ["0.5", 30_000],
      ["2.125", 127_500],
      ["0:00", 0],
      ["0:01", 1_000],
      ["1:00", 60_000],
      ["1:23", 83_000],
      ["1:23.1", 83_100],
      ["1:23.12", 83_120],
      ["1:23.123", 83_123],
      ["10:59.999", 659_999],
      ["123:45.678", 7_425_678],
    ])("decodes %j to %j", (value, expected) => {
      expect(decodeComparisonTime(value)).toBe(expected);
    });

    test.each([
      "1:",
      ":01",
      "1:1",
      "1:60",
      "1:99",
      "1:23.",
      "1:23.1234",
      "1:23.abc",
      "-1",
      "-1.25",
      "-1:00",
      ".5",
      "1.",
      "abc",
      " 1:23",
      "1:23 ",
      " 1.25",
      "1.25 ",
    ])("rejects %j", (value) => {
      const result = decodeComparisonTimeResult(value);

      expect(result._tag).toBe("Failure");
    });
  });

  describe("encode", () => {
    test.each([
      [null, ""],
      [0, "0:00"],
      [1_000, "0:01"],
      [30_000, "0:30"],
      [60_000, "1:00"],
      [75_000, "1:15"],
      [83_000, "1:23"],
      [83_100, "1:23.100"],
      [83_120, "1:23.120"],
      [83_123, "1:23.123"],
      [127_500, "2:07.500"],
      [659_999, "10:59.999"],
      [7_425_678, "123:45.678"],
    ])("encodes %j to %j", (value, expected) => {
      expect(encodeComparisonTime(value)).toBe(expected);
    });
  });
});
