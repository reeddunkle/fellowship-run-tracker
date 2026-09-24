import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { type ImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { groupBackgroundJobsByCategory } from "@/renderer/api/background-job/background-job-categories.ts";

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
