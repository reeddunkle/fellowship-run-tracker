import * as DateTime from "effect/DateTime";
import { describe, expect, test } from "vitest";

import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-jobs/get-background-job-idempotency-key.ts";

const SESSION_STARTED_AT = DateTime.makeUnsafe("2026-09-23T08:00:00.000Z");
const NEXT_SESSION_STARTED_AT = DateTime.makeUnsafe("2026-09-23T09:00:00.000Z");

describe("getBackgroundJobIdempotencyKey", () => {
  test("gives InterruptUnfinishedDungeonRuns one key per session", () => {
    const key = getBackgroundJobIdempotencyKey({
      _tag: "InterruptUnfinishedDungeonRuns",
      createdBefore: SESSION_STARTED_AT,
    });

    const sameSessionKey = getBackgroundJobIdempotencyKey({
      _tag: "InterruptUnfinishedDungeonRuns",
      createdBefore: SESSION_STARTED_AT,
    });

    const nextSessionKey = getBackgroundJobIdempotencyKey({
      _tag: "InterruptUnfinishedDungeonRuns",
      createdBefore: NEXT_SESSION_STARTED_AT,
    });

    expect(key).toBe(
      `interrupt-unfinished-dungeon-runs/${DateTime.toEpochMillis(SESSION_STARTED_AT)}`,
    );
    expect(sameSessionKey).toBe(key);
    expect(nextSessionKey).not.toBe(key);
  });
});
