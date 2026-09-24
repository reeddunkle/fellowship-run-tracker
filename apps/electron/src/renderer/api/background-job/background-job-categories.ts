import * as A from "effect/Array";
import * as R from "effect/Record";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";

type BackgroundJobCategory = {
  readonly label: string;
};

const BACKGROUND_JOB_CATEGORIES = {
  "fellowship-logs-import": {
    label: "Fellowship Logs imports",
  },
} as const satisfies Record<string, BackgroundJobCategory>;

export type BackgroundJobCategoryId = keyof typeof BACKGROUND_JOB_CATEGORIES;

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
