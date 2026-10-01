import * as Schema from "effect/Schema";
import { describe, expect, test, vi } from "vitest";

import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

import {
  BACKGROUND_JOB_TOAST_LINGER_MILLISECONDS,
  getNextToastExpiryMilliseconds,
  getToastVisibleBackgroundJobs,
} from "@/renderer/stores/background-job/background-job-toast-visibility.ts";
import {
  getBackgroundJobToastType,
  isBackgroundJobToastDismissed,
  pruneDismissedBackgroundJobPhases,
  sortBackgroundJobsForToasts,
  syncBackgroundJobToasts,
} from "@/renderer/stores/background-job/sync-background-job-toasts.ts";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

const NOW = 100_000;

const toJobId = Schema.decodeSync(BackgroundJobIdSchema);

function getIds(jobs: ReadonlyArray<{ readonly id: string }>) {
  return jobs.map((job) => {
    return job.id;
  });
}

describe("getToastVisibleBackgroundJobs", () => {
  test("keeps active jobs and recently finished jobs", () => {
    const jobs = [
      makeImportJob("queued", "QUEUED"),
      makeImportJob("running", "RUNNING"),
      makeImportJob("waiting", "WAITING"),
      makeImportJob("recent", "SUCCEEDED", {
        finishedAtMilliseconds: NOW - 1_000,
      }),
      makeImportJob("expired", "FAILED", {
        finishedAtMilliseconds: NOW - BACKGROUND_JOB_TOAST_LINGER_MILLISECONDS,
      }),
      makeImportJob("unknown-finish", "SUCCEEDED"),
    ];

    expect(getIds(getToastVisibleBackgroundJobs(jobs, NOW))).toEqual([
      "queued",
      "running",
      "waiting",
      "recent",
    ]);
  });
});

describe("getNextToastExpiryMilliseconds", () => {
  test("returns the soonest upcoming expiry", () => {
    const jobs = [
      makeImportJob("running", "RUNNING"),
      makeImportJob("later", "SUCCEEDED", {
        finishedAtMilliseconds: NOW - 1_000,
      }),
      makeImportJob("sooner", "FAILED", {
        finishedAtMilliseconds: NOW - 3_000,
      }),
      makeImportJob("expired", "SUCCEEDED", {
        finishedAtMilliseconds: NOW - 10_000,
      }),
    ];

    expect(getNextToastExpiryMilliseconds(jobs, NOW)).toBe(
      NOW - 3_000 + BACKGROUND_JOB_TOAST_LINGER_MILLISECONDS,
    );
  });

  test("is undefined when nothing will expire", () => {
    expect(
      getNextToastExpiryMilliseconds([makeImportJob("q", "QUEUED")], NOW),
    ).toBeUndefined();
  });
});

describe("getBackgroundJobToastType", () => {
  test("follows the job's status", () => {
    expect(getBackgroundJobToastType(makeImportJob("q", "QUEUED"))).toBe(
      "loading",
    );
    expect(getBackgroundJobToastType(makeImportJob("r", "RUNNING"))).toBe(
      "loading",
    );
    expect(getBackgroundJobToastType(makeImportJob("w", "WAITING"))).toBe(
      "loading",
    );
    expect(
      getBackgroundJobToastType(
        makeImportJob("f", "FAILED", { finishedAtMilliseconds: NOW }),
      ),
    ).toBe("error");
    expect(
      getBackgroundJobToastType(
        makeImportJob("s", "SUCCEEDED", { finishedAtMilliseconds: NOW }),
      ),
    ).toBe("success");
  });
});

describe("dismissed toasts", () => {
  test("stay hidden while the job keeps running or finishes", () => {
    const dismissed = new Map([[toJobId("job-1"), "active" as const]]);

    expect(
      isBackgroundJobToastDismissed(
        makeImportJob("job-1", "RUNNING"),
        dismissed,
      ),
    ).toBe(true);
    expect(
      isBackgroundJobToastDismissed(
        makeImportJob("job-1", "SUCCEEDED", { finishedAtMilliseconds: NOW }),
        dismissed,
      ),
    ).toBe(true);
    expect(
      isBackgroundJobToastDismissed(
        makeImportJob("job-2", "QUEUED"),
        dismissed,
      ),
    ).toBe(false);
  });

  test("come back when a finished job is retried", () => {
    const dismissed = new Map([[toJobId("job-1"), "finished" as const]]);

    expect(
      isBackgroundJobToastDismissed(
        makeImportJob("job-1", "FAILED", { finishedAtMilliseconds: NOW }),
        dismissed,
      ),
    ).toBe(true);
    expect(
      isBackgroundJobToastDismissed(
        makeImportJob("job-1", "QUEUED"),
        dismissed,
      ),
    ).toBe(false);
  });

  test("are forgotten once the job is no longer visible or was retried", () => {
    const dismissed = new Map([
      [toJobId("gone"), "active" as const],
      [toJobId("retried"), "finished" as const],
      [toJobId("running"), "active" as const],
    ]);

    const pruned = pruneDismissedBackgroundJobPhases(dismissed, [
      makeImportJob("retried", "QUEUED"),
      makeImportJob("running", "RUNNING"),
    ]);

    expect([...pruned.keys()]).toEqual(["running"]);
  });
});

describe("syncBackgroundJobToasts", () => {
  test("shows each job and closes toasts for jobs that are gone", () => {
    const showToast = vi.fn();
    const closeToast = vi.fn();
    const entries = [
      { job: makeImportJob("job-1", "QUEUED") },
      { job: makeImportJob("job-2", "RUNNING") },
    ];

    const openJobIds = syncBackgroundJobToasts({
      closeToast,
      entries,
      openJobIds: new Set(),
      showToast,
    });

    expect(showToast).toHaveBeenCalledTimes(2);
    expect(closeToast).not.toHaveBeenCalled();
    expect([...openJobIds]).toEqual(["job-1", "job-2"]);

    const nextOpenJobIds = syncBackgroundJobToasts({
      closeToast,
      entries: entries.slice(1),
      openJobIds,
      showToast,
    });

    expect(closeToast).toHaveBeenCalledExactlyOnceWith("job-1");
    expect([...nextOpenJobIds]).toEqual(["job-2"]);
  });
});

describe("sortBackgroundJobsForToasts", () => {
  test("puts the current job first, then the queue in order, then finished jobs", () => {
    const entries = [
      {
        job: makeImportJob("queued-later", "QUEUED", {
          createdAtMilliseconds: 4,
        }),
      },
      {
        job: makeImportJob("succeeded", "SUCCEEDED", {
          createdAtMilliseconds: 1,
          finishedAtMilliseconds: NOW,
        }),
      },
      {
        job: makeImportJob("queued-sooner", "QUEUED", {
          createdAtMilliseconds: 3,
        }),
      },
      {
        job: makeImportJob("running", "RUNNING", { createdAtMilliseconds: 2 }),
      },
    ];

    expect(
      sortBackgroundJobsForToasts(entries).map(({ job }) => {
        return job.id;
      }),
    ).toEqual(["running", "queued-sooner", "queued-later", "succeeded"]);
  });
});
