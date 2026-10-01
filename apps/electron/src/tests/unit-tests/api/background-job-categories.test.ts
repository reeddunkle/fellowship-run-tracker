import { describe, expect, test } from "vitest";

import { groupBackgroundJobsByCategory } from "@/renderer/api/background-job/background-job-categories.ts";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

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
