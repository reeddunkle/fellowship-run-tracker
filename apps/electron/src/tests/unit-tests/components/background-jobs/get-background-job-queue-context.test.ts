import { describe, expect, test } from "vitest";

import { getBackgroundJobQueueContext } from "@/renderer/components/background-jobs/background-job-descriptions.ts";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

describe("getBackgroundJobQueueContext", () => {
  test("treats the queue as paused while a job waits on points", () => {
    const context = getBackgroundJobQueueContext([
      makeImportJob("waiting", "WAITING"),
      makeImportJob("queued", "QUEUED"),
    ]);

    expect(context.isQueueWaiting).toBe(true);
  });

  test("doesn't treat a job held for a profile-change confirmation as pausing the queue", () => {
    const context = getBackgroundJobQueueContext([
      makeImportJob("held", "WAITING", {
        availableAtMilliseconds: null,
        waitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
      }),
      makeImportJob("queued", "QUEUED"),
    ]);

    expect(context.isQueueWaiting).toBe(false);
    expect(context.queuedJobIds).toEqual(["queued"]);
  });
});
