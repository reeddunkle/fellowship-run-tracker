import { describe, expect, test } from "vitest";

import {
  type BackgroundJobApiSnapshot,
  type ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
} from "@frt/shared/background-job/background-job-api-schema.ts";

import {
  getNewlyFinishedBackgroundJobs,
  getNewlyWaitingBackgroundJobs,
} from "@/renderer/stores/background-job/get-newly-finished-background-jobs.ts";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

function makeSnapshot(
  jobs: ReadonlyArray<ImportFellowshipLogsDungeonRunBackgroundJobApiItem>,
): BackgroundJobApiSnapshot {
  return { jobs, revision: 0, sessionId: "session" };
}

describe("getNewlyWaitingBackgroundJobs", () => {
  test("finds jobs that just started waiting", () => {
    const previous = makeSnapshot([
      makeImportJob("job-1", "RUNNING"),
      makeImportJob("job-2", "WAITING"),
    ]);
    const next = makeSnapshot([
      makeImportJob("job-1", "WAITING"),
      makeImportJob("job-2", "WAITING"),
    ]);

    expect(
      getNewlyWaitingBackgroundJobs(previous, next).map((job) => job.id),
    ).toEqual(["job-1"]);
  });
});

describe("getNewlyFinishedBackgroundJobs", () => {
  test("finds jobs that just succeeded or failed", () => {
    const previous = makeSnapshot([
      makeImportJob("succeeded", "RUNNING"),
      makeImportJob("failed", "RUNNING"),
      makeImportJob("already-finished", "SUCCEEDED"),
      makeImportJob("still-running", "RUNNING"),
    ]);
    const next = makeSnapshot([
      makeImportJob("succeeded", "SUCCEEDED"),
      makeImportJob("failed", "FAILED"),
      makeImportJob("already-finished", "SUCCEEDED"),
      makeImportJob("still-running", "RUNNING"),
    ]);

    expect(
      getNewlyFinishedBackgroundJobs(previous, next).map((job) => job.id),
    ).toEqual(["succeeded", "failed"]);
  });

  test("doesn't count waiting jobs as finished", () => {
    const previous = makeSnapshot([makeImportJob("job-1", "RUNNING")]);
    const next = makeSnapshot([makeImportJob("job-1", "WAITING")]);

    expect(getNewlyFinishedBackgroundJobs(previous, next)).toEqual([]);
  });
});
