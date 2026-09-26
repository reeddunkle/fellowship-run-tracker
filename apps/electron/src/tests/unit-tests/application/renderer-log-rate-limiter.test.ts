import { describe, expect, test } from "vitest";

import { makeRendererLogRateLimiter } from "@/ipc/handlers/renderer-log-rate-limiter.ts";

function makeLimiter() {
  return makeRendererLogRateLimiter({
    maxEntriesPerWindow: 2,
    maxTrackedKeys: 10,
    windowMilliseconds: 1_000,
  });
}

describe("makeRendererLogRateLimiter", () => {
  test("allows a limited number of entries per message within a window", () => {
    const check = makeLimiter();

    expect(check("a", 0)).toEqual({ isAllowed: true, suppressedCount: 0 });
    expect(check("a", 10)).toEqual({ isAllowed: true, suppressedCount: 0 });
    expect(check("a", 20)).toEqual({ isAllowed: false });
    expect(check("b", 30)).toEqual({ isAllowed: true, suppressedCount: 0 });
  });

  test("reports how many entries were suppressed once the window resets", () => {
    const check = makeLimiter();

    check("a", 0);
    check("a", 1);
    check("a", 2);
    check("a", 3);

    expect(check("a", 1_000)).toEqual({ isAllowed: true, suppressedCount: 2 });
    expect(check("a", 1_001)).toEqual({ isAllowed: true, suppressedCount: 0 });
  });
});
