import * as DateTime from "effect/DateTime";
import * as Redacted from "effect/Redacted";
import { describe, expect, test } from "vitest";

import { formatCrashLogEntry } from "@/crash-log-entry.ts";

const MARKER_SECRET = "marker-crash-secret-7b2f4f6c";

describe("formatCrashLogEntry", () => {
  test("does not serialize redacted values carried by a crash", () => {
    const output = formatCrashLogEntry(
      "FATAL",
      "Failed to load the application.",
      Redacted.make(MARKER_SECRET),
      DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")),
    );

    expect(output).not.toContain(MARKER_SECRET);
    expect(output).toContain("<redacted>");
  });
});
