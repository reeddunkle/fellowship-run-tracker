import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  ComparisonTimeFormSchema,
  formatComparisonTime,
  parseColonTime,
  parseDecimalMinutes,
} from "@frt/shared/milestone/comparison-time-form-schema.ts";

const decodeComparisonTimeResult = Schema.decodeUnknownResult(
  ComparisonTimeFormSchema,
);

describe("parseColonTime", () => {
  describe("parses", () => {
    test("zero", () => {
      expect(parseColonTime("0:00")).toBe(0);
    });

    test("minutes and seconds", () => {
      expect(parseColonTime("1:23")).toBe(83_000);
    });

    test("one fractional digit as tenths", () => {
      expect(parseColonTime("1:23.1")).toBe(83_100);
    });

    test("three fractional digits as milliseconds", () => {
      expect(parseColonTime("1:23.123")).toBe(83_123);
    });

    test("more than two minute digits", () => {
      expect(parseColonTime("123:45.678")).toBe(7_425_678);
    });
  });

  describe("rejects", () => {
    test("an empty string", () => {
      expect(parseColonTime("")).toBeUndefined();
    });

    test("missing seconds", () => {
      expect(parseColonTime("1:")).toBeUndefined();
    });

    test("missing minutes", () => {
      expect(parseColonTime(":01")).toBeUndefined();
    });

    test("single-digit seconds", () => {
      expect(parseColonTime("1:1")).toBeUndefined();
    });

    test("seconds of 60 or more", () => {
      expect(parseColonTime("1:60")).toBeUndefined();
    });

    test("a trailing decimal point", () => {
      expect(parseColonTime("1:23.")).toBeUndefined();
    });

    test("more than three fractional digits", () => {
      expect(parseColonTime("1:23.1234")).toBeUndefined();
    });

    test("a negative time", () => {
      expect(parseColonTime("-1:00")).toBeUndefined();
    });

    test("surrounding whitespace", () => {
      expect(parseColonTime(" 1:23")).toBeUndefined();
    });
  });
});

describe("parseDecimalMinutes", () => {
  describe("parses", () => {
    test("zero", () => {
      expect(parseDecimalMinutes("0")).toBe(0);
    });

    test("whole minutes", () => {
      expect(parseDecimalMinutes("1")).toBe(60_000);
    });

    test("fractional minutes", () => {
      expect(parseDecimalMinutes("1.25")).toBe(75_000);
    });

    test("fractional minutes that land on whole milliseconds", () => {
      expect(parseDecimalMinutes("10.001")).toBe(600_060);
    });
  });

  describe("rejects", () => {
    test("an empty string", () => {
      expect(parseDecimalMinutes("")).toBeUndefined();
    });

    test("a missing whole part", () => {
      expect(parseDecimalMinutes(".5")).toBeUndefined();
    });

    test("a trailing decimal point", () => {
      expect(parseDecimalMinutes("1.")).toBeUndefined();
    });

    test("colon time", () => {
      expect(parseDecimalMinutes("1:00")).toBeUndefined();
    });

    test("a negative number", () => {
      expect(parseDecimalMinutes("-1")).toBeUndefined();
    });

    test("more than one decimal point", () => {
      expect(parseDecimalMinutes("1.2.3")).toBeUndefined();
    });

    test("surrounding whitespace", () => {
      expect(parseDecimalMinutes(" 1")).toBeUndefined();
    });
  });

  test("rounds fractional milliseconds", () => {
    expect(parseDecimalMinutes("1.333333")).toBe(80_000);
  });
});

describe("ComparisonTimeFormSchema", () => {
  describe("decode", () => {
    function expectDecodesTo(value: string, expected: number | null) {
      const result = decodeComparisonTimeResult(value);

      expect(result._tag).toBe("Success");

      if (result._tag === "Success") {
        expect(result.success).toBe(expected);
      }
    }

    test("decodes an empty string to null", () => {
      expectDecodesTo("", null);
    });

    test("decodes colon time", () => {
      expectDecodesTo("1:23.123", 83_123);
    });

    test("decodes decimal minutes", () => {
      expectDecodesTo("1.25", 75_000);
    });

    test("rejects a value neither parser accepts", () => {
      expect(decodeComparisonTimeResult("abc")._tag).toBe("Failure");
    });
  });
});

describe("formatComparisonTime", () => {
  test("formats no time as an empty string", () => {
    expect(formatComparisonTime(null)).toBe("");
  });

  test("formats zero", () => {
    expect(formatComparisonTime(0)).toBe("0:00");
  });

  test("pads seconds to two digits", () => {
    expect(formatComparisonTime(75_000)).toBe("1:15");
  });

  test("pads milliseconds to three digits", () => {
    expect(formatComparisonTime(83_100)).toBe("1:23.100");
  });

  test("formats milliseconds", () => {
    expect(formatComparisonTime(659_999)).toBe("10:59.999");
  });

  test("formats more than two minute digits", () => {
    expect(formatComparisonTime(7_425_678)).toBe("123:45.678");
  });
});
