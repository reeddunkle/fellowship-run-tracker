import { describe, expect, test } from "vitest";

import { resolveLogLevel } from "@frt/api/logging/log-level.ts";

describe("resolveLogLevel", () => {
  test("defaults to Info for the packaged app and Debug otherwise", () => {
    expect(resolveLogLevel({ argv: [], env: {}, isPackaged: true })).toBe(
      "Info",
    );
    expect(resolveLogLevel({ argv: [], env: {}, isPackaged: false })).toBe(
      "Debug",
    );
  });

  test("uses LOG_LEVEL case-insensitively", () => {
    expect(
      resolveLogLevel({
        argv: [],
        env: { LOG_LEVEL: "warn" },
        isPackaged: true,
      }),
    ).toBe("Warn");
  });

  test("prefers the --log-level argument over LOG_LEVEL", () => {
    expect(
      resolveLogLevel({
        argv: ["app.exe", "--log-level=DEBUG"],
        env: { LOG_LEVEL: "error" },
        isPackaged: true,
      }),
    ).toBe("Debug");
  });

  test("accepts warning as an alias for Warn", () => {
    expect(
      resolveLogLevel({
        argv: ["--log-level=warning"],
        env: {},
        isPackaged: false,
      }),
    ).toBe("Warn");
  });

  test("falls back past invalid values", () => {
    expect(
      resolveLogLevel({
        argv: ["--log-level=loud"],
        env: { LOG_LEVEL: "error" },
        isPackaged: true,
      }),
    ).toBe("Error");

    expect(
      resolveLogLevel({
        argv: ["--log-level="],
        env: { LOG_LEVEL: "verbose" },
        isPackaged: true,
      }),
    ).toBe("Info");
  });
});
