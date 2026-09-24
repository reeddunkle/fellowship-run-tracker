import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { type ImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import {
  getBackgroundJobSummary,
  groupBackgroundJobsByCategory,
} from "@/renderer/api/background-job/background-job-categories.ts";

function makeImportJob(
  id: string,
  status: ImportFellowshipLogsDungeonRunBackgroundJobApiItem["status"],
): ImportFellowshipLogsDungeonRunBackgroundJobApiItem {
  return {
    attempts: 0,
    availableAtMilliseconds: status === "WAITING" ? 60_000 : null,
    createdAtMilliseconds: 0,
    error: null,
    finishedAtMilliseconds: null,
    id: Schema.decodeSync(BackgroundJobIdSchema)(id),
    kind: "ImportFellowshipLogsDungeonRun",
    payload: {
      dungeonId: "100006",
      dungeonLevel: 12,
      fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
      isOwnRun: true,
      reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
        "XdfFZzgHBJNr6m3v",
      ),
    },
    progress: status === "RUNNING" ? 0.5 : null,
    result: null,
    startedAtMilliseconds: null,
    status,
  };
}

describe("groupBackgroundJobsByCategory", () => {
  test("buckets jobs by category and keeps their queue order", () => {
    const jobs = [
      makeImportJob("job-1", "RUNNING"),
      makeImportJob("job-2", "QUEUED"),
      makeImportJob("job-3", "FAILED"),
      makeImportJob("job-4", "QUEUED"),
    ];

    const groups = groupBackgroundJobsByCategory(jobs);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.categoryId).toBe("fellowship-logs-import");
    expect(groups[0]?.label).toBe("Fellowship Logs imports");
    expect(groups[0]?.jobs.map((job) => job.id)).toEqual([
      "job-1",
      "job-2",
      "job-3",
      "job-4",
    ]);
  });

  test("leaves out categories with no jobs", () => {
    expect(groupBackgroundJobsByCategory([])).toEqual([]);
  });
});

describe("getBackgroundJobSummary", () => {
  test("is idle with no jobs", () => {
    expect(getBackgroundJobSummary([])).toEqual({
      activeCount: 0,
      failedCount: 0,
      queuedCount: 0,
      runningJob: undefined,
      state: "idle",
      waitingCount: 0,
    });
  });

  test("counts active jobs and finds the running one", () => {
    const runningJob = makeImportJob("job-1", "RUNNING");

    const summary = getBackgroundJobSummary([
      runningJob,
      makeImportJob("job-2", "QUEUED"),
      makeImportJob("job-3", "QUEUED"),
      makeImportJob("job-4", "SUCCEEDED"),
    ]);

    expect(summary).toEqual({
      activeCount: 3,
      failedCount: 0,
      queuedCount: 2,
      runningJob,
      state: "running",
      waitingCount: 0,
    });
  });

  test("reports failures ahead of running jobs", () => {
    const summary = getBackgroundJobSummary([
      makeImportJob("job-1", "RUNNING"),
      makeImportJob("job-2", "FAILED"),
    ]);

    expect(summary.state).toBe("failed");
    expect(summary.failedCount).toBe(1);
    expect(summary.activeCount).toBe(1);
  });

  test("stays failed after the queue drains until failures are cleared", () => {
    const summary = getBackgroundJobSummary([
      makeImportJob("job-1", "FAILED"),
      makeImportJob("job-2", "SUCCEEDED"),
    ]);

    expect(summary.state).toBe("failed");
    expect(summary.activeCount).toBe(0);
  });

  test("is idle when only succeeded jobs remain", () => {
    expect(
      getBackgroundJobSummary([makeImportJob("job-1", "SUCCEEDED")]).state,
    ).toBe("idle");
  });

  test("is waiting when a job waits and nothing runs", () => {
    const summary = getBackgroundJobSummary([
      makeImportJob("job-1", "WAITING"),
      makeImportJob("job-2", "QUEUED"),
    ]);

    expect(summary).toEqual({
      activeCount: 2,
      failedCount: 0,
      queuedCount: 1,
      runningJob: undefined,
      state: "waiting",
      waitingCount: 1,
    });
  });

  test("reports a running job ahead of a waiting one", () => {
    const summary = getBackgroundJobSummary([
      makeImportJob("job-1", "WAITING"),
      makeImportJob("job-2", "RUNNING"),
    ]);

    expect(summary.state).toBe("running");
  });
});
