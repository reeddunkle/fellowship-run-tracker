import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  type BackgroundJobApiSnapshot,
  type ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
} from "@frt/shared/background-job/background-job-api-schema.ts";
import { BackgroundJobIdSchema } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import {
  getNewlyFinishedBackgroundJobs,
  getNewlyWaitingBackgroundJobs,
} from "@/renderer/stores/background-job/get-newly-finished-background-jobs.ts";

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
    progress: null,
    result: null,
    startedAtMilliseconds: null,
    status,
  };
}

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

  test("doesn't count waiting jobs as finished", () => {
    const previous = makeSnapshot([makeImportJob("job-1", "RUNNING")]);
    const next = makeSnapshot([makeImportJob("job-1", "WAITING")]);

    expect(getNewlyFinishedBackgroundJobs(previous, next)).toEqual([]);
  });
});
