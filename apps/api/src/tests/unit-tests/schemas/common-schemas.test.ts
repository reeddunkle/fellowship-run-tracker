import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  IntegerFromStringSchema,
  JsonStringSchema,
} from "@frt/shared/util/common-schemas.ts";

const decodeJsonStringResult = Schema.decodeUnknownResult(JsonStringSchema);
const encodeJsonString = Schema.encodeSync(JsonStringSchema);
const decodeIntegerFromStringResult = Schema.decodeUnknownResult(
  IntegerFromStringSchema,
);

describe("JsonStringSchema", () => {
  describe("decodes", () => {
    test("a plain string", () => {
      expect(decodeJsonStringResult('"billy"')).toEqual(
        Result.succeed("billy"),
      );
    });

    test("an empty string", () => {
      expect(decodeJsonStringResult('""')).toEqual(Result.succeed(""));
    });

    test("escaped quotes and backslashes", () => {
      expect(decodeJsonStringResult('"say \\"hi\\" \\\\ bye"')).toEqual(
        Result.succeed('say "hi" \\ bye'),
      );
    });

    test("short escapes", () => {
      expect(decodeJsonStringResult('"a\\/b\\nc\\td"')).toEqual(
        Result.succeed("a/b\nc\td"),
      );
    });

    test("unicode escapes", () => {
      expect(decodeJsonStringResult('"\\u00e9t\\u00E9"')).toEqual(
        Result.succeed("été"),
      );
    });

    test("non-ASCII characters", () => {
      expect(decodeJsonStringResult('"Ælfwyn’s Ward 🔥"')).toEqual(
        Result.succeed("Ælfwyn’s Ward 🔥"),
      );
    });
  });

  describe("rejects", () => {
    test("an unquoted string", () => {
      expect(Result.isFailure(decodeJsonStringResult("billy"))).toBe(true);
    });

    test("a JSON number", () => {
      expect(Result.isFailure(decodeJsonStringResult("42"))).toBe(true);
    });

    test("an unterminated string", () => {
      expect(Result.isFailure(decodeJsonStringResult('"billy'))).toBe(true);
    });

    test("an unescaped inner quote", () => {
      expect(Result.isFailure(decodeJsonStringResult('"bi"lly"'))).toBe(true);
    });

    test("an invalid escape", () => {
      expect(Result.isFailure(decodeJsonStringResult('"bi\\qlly"'))).toBe(true);
    });

    test("a short unicode escape", () => {
      expect(Result.isFailure(decodeJsonStringResult('"\\u00e"'))).toBe(true);
    });

    test("a raw control character", () => {
      expect(Result.isFailure(decodeJsonStringResult('"bi\nlly"'))).toBe(true);
    });

    test("a trailing backslash", () => {
      expect(Result.isFailure(decodeJsonStringResult('"billy\\"'))).toBe(true);
    });
  });

  describe("encodes", () => {
    test("a string with quotes and newlines", () => {
      expect(encodeJsonString('say "hi"\n')).toBe('"say \\"hi\\"\\n"');
    });
  });
});

describe("IntegerFromStringSchema", () => {
  describe("decodes", () => {
    test("a positive integer", () => {
      expect(decodeIntegerFromStringResult("41947")).toEqual(
        Result.succeed(41_947),
      );
    });

    test("a negative integer", () => {
      expect(decodeIntegerFromStringResult("-3")).toEqual(Result.succeed(-3));
    });
  });

  describe("rejects", () => {
    test("a fraction", () => {
      expect(Result.isFailure(decodeIntegerFromStringResult("1.5"))).toBe(true);
    });

    test("a non-numeric string", () => {
      expect(Result.isFailure(decodeIntegerFromStringResult("abc"))).toBe(true);
    });
  });
});
