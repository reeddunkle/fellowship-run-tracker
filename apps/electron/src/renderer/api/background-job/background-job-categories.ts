import * as A from "effect/Array";
import * as R from "effect/Record";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";

type BackgroundJobCategory = {
  readonly label: string;
};

/*
 * Categories in display order. Every job kind maps to exactly one category
 * (see `BACKGROUND_JOB_CATEGORY_BY_KIND`).
 */
const BACKGROUND_JOB_CATEGORIES = {
  "fellowship-logs-import": {
    label: "Fellowship Logs imports",
  },
} as const satisfies Record<string, BackgroundJobCategory>;

export type BackgroundJobCategoryId = keyof typeof BACKGROUND_JOB_CATEGORIES;

// Adding a job kind fails to compile until it's given a category.
const BACKGROUND_JOB_CATEGORY_BY_KIND = {
  ImportFellowshipLogsDungeonRun: "fellowship-logs-import",
} as const satisfies Record<
  BackgroundJobApiItem["kind"],
  BackgroundJobCategoryId
>;

export type BackgroundJobGroup = {
  readonly categoryId: BackgroundJobCategoryId;
  readonly jobs: A.NonEmptyReadonlyArray<BackgroundJobApiItem>;
  readonly label: string;
};

export function getBackgroundJobCategoryId(
  job: BackgroundJobApiItem,
): BackgroundJobCategoryId {
  return BACKGROUND_JOB_CATEGORY_BY_KIND[job.kind];
}

/**
 * Buckets jobs by category, in category display order. Jobs keep their queue
 * order (the order the API lists them in) within each bucket. Empty
 * categories are left out.
 */
export function groupBackgroundJobsByCategory(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
): ReadonlyArray<BackgroundJobGroup> {
  const jobsByCategory = A.groupBy(jobs, getBackgroundJobCategoryId);

  return R.keys(BACKGROUND_JOB_CATEGORIES).flatMap((categoryId) => {
    const categoryJobs = jobsByCategory[categoryId];

    return categoryJobs === undefined
      ? []
      : [
          {
            categoryId,
            jobs: categoryJobs,
            label: BACKGROUND_JOB_CATEGORIES[categoryId].label,
          },
        ];
  });
}

type BackgroundJobSummaryState = "failed" | "idle" | "running";

export type BackgroundJobSummary = {
  /** Queued plus running jobs. */
  readonly activeCount: number;
  /** Failed jobs the user hasn't dismissed or retried. */
  readonly failedCount: number;
  readonly queuedCount: number;
  readonly runningJob: BackgroundJobApiItem | undefined;
  /** `failed` takes precedence over `running`. */
  readonly state: BackgroundJobSummaryState;
};

function countWithStatus(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  status: BackgroundJobApiItem["status"],
): number {
  return jobs.filter((job) => {
    return job.status === status;
  }).length;
}

export function getBackgroundJobSummary(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
): BackgroundJobSummary {
  const queuedCount = countWithStatus(jobs, "QUEUED");
  const failedCount = countWithStatus(jobs, "FAILED");
  const runningJob = jobs.find((job) => {
    return job.status === "RUNNING";
  });
  const activeCount = queuedCount + countWithStatus(jobs, "RUNNING");

  const state: BackgroundJobSummaryState =
    failedCount > 0 ? "failed" : activeCount > 0 ? "running" : "idle";

  return { activeCount, failedCount, queuedCount, runningJob, state };
}
