import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { createBackgroundJobApiItem } from "@frt/api/services/api/background-job/create-background-job-api-response.ts";
import { BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

const CREATED_AT = DateTime.makeUnsafe("2026-09-23T08:00:00.000Z");
const STARTED_AT = DateTime.makeUnsafe("2026-09-23T08:00:01.000Z");

function makeJob(
  overrides: Partial<ConstructorParameters<typeof BackgroundJobModel>[0]> = {},
) {
  return new BackgroundJobModel({
    attempts: 1,
    availableAt: null,
    createdAt: CREATED_AT,
    error: null,
    finishedAt: null,
    id: Schema.decodeSync(BackgroundJobIdSchema)("job-1"),
    idempotencyKey: "fellowship-logs-import/XdfFZzgHBJNr6m3v/15",
    kind: "ImportFellowshipLogsDungeonRun",
    payload: {
      _tag: "ImportFellowshipLogsDungeonRun",
      dungeonId: "100006",
      dungeonLevel: 12,
      fightId: 15,
      isOwnRun: true,
      reportCode: "XdfFZzgHBJNr6m3v",
    },
    queue: "fellowship-logs-import",
    result: null,
    startedAt: STARTED_AT,
    status: "RUNNING",
    updatedAt: STARTED_AT,
    ...overrides,
  });
}

describe("createBackgroundJobApiItem", () => {
  test("maps an import job with its progress", () => {
    const item = Option.getOrThrow(
      createBackgroundJobApiItem({ job: makeJob(), progress: 0.25 }),
    );

    expect(item).toMatchObject({
      kind: "ImportFellowshipLogsDungeonRun",
      payload: {
        dungeonId: "100006",
        dungeonLevel: 12,
        fightId: 15,
        isOwnRun: true,
        reportCode: "XdfFZzgHBJNr6m3v",
      },
      progress: 0.25,
      startedAtMilliseconds: DateTime.toEpochMillis(STARTED_AT),
      status: "RUNNING",
    });
  });

  test("maps a waiting import job with when it resumes and why", () => {
    const availableAt = DateTime.makeUnsafe("2026-09-23T09:00:00.000Z");
    const reason = {
      message: "Out of points.",
      tag: "FellowshipLogsRateLimitExceededError",
    };

    const item = Option.getOrThrow(
      createBackgroundJobApiItem({
        job: makeJob({
          attempts: 0,
          availableAt,
          error: reason,
          startedAt: null,
          status: "WAITING",
        }),
        progress: null,
      }),
    );

    expect(item).toMatchObject({
      availableAtMilliseconds: DateTime.toEpochMillis(availableAt),
      error: reason,
      startedAtMilliseconds: null,
      status: "WAITING",
    });
  });

  test("leaves out a job whose payload no longer decodes", () => {
    const item = createBackgroundJobApiItem({
      job: makeJob({ payload: { _tag: "ImportFellowshipLogsDungeonRun" } }),
      progress: null,
    });

    expect(Option.isNone(item)).toBe(true);
  });

  test("leaves out job kinds the user doesn't see", () => {
    const item = createBackgroundJobApiItem({
      job: makeJob({
        kind: "PruneLogFiles",
        payload: { _tag: "PruneLogFiles" },
      }),
      progress: null,
    });

    expect(Option.isNone(item)).toBe(true);
  });
});
