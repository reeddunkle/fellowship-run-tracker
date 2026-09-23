import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { getBackgroundJobIdempotencyKey } from "@frt/api/services/background-job/get-background-job-idempotency-key.ts";
import { MOCK_DUNGEON_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "XdfFZzgHBJNr6m3v",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

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

  test("gives ImportFellowshipLogsDungeonRun one key per report fight", () => {
    const job = {
      _tag: "ImportFellowshipLogsDungeonRun",
      dungeonId: MOCK_DUNGEON_ID,
      dungeonLevel: 10,
      fightId: FIGHT_ID,
      isOwnRun: true,
      reportCode: REPORT_CODE,
    } as const;

    expect(getBackgroundJobIdempotencyKey(job)).toBe(
      `fellowship-logs-import/${REPORT_CODE}/${FIGHT_ID}`,
    );
    expect(getBackgroundJobIdempotencyKey({ ...job, isOwnRun: false })).toBe(
      getBackgroundJobIdempotencyKey(job),
    );
    expect(
      getBackgroundJobIdempotencyKey({
        ...job,
        fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(16),
      }),
    ).not.toBe(getBackgroundJobIdempotencyKey(job));
  });

  test("gives every PruneLogFiles job the same key", () => {
    expect(getBackgroundJobIdempotencyKey({ _tag: "PruneLogFiles" })).toBe(
      getBackgroundJobIdempotencyKey({ _tag: "PruneLogFiles" }),
    );
  });
});
