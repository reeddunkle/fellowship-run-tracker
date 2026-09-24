import {
  type BackgroundJobApiItem,
  type BackgroundJobApiSnapshot,
} from "@frt/shared/background-job/background-job-api-schema.ts";

function isFinished(job: BackgroundJobApiItem): boolean {
  return job.status === "SUCCEEDED" || job.status === "FAILED";
}

function isWaiting(job: BackgroundJobApiItem): boolean {
  return job.status === "WAITING";
}

function getJobsNewlyMatching(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
  predicate: (job: BackgroundJobApiItem) => boolean,
): ReadonlyArray<BackgroundJobApiItem> {
  const previousStatuses = new Map(
    (previous?.jobs ?? []).map((job) => {
      return [job.id, job.status] as const;
    }),
  );

  return next.jobs.filter((job) => {
    return predicate(job) && previousStatuses.get(job.id) !== job.status;
  });
}

export function getNewlyFinishedBackgroundJobs(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): ReadonlyArray<BackgroundJobApiItem> {
  return getJobsNewlyMatching(previous, next, isFinished);
}

export function getNewlyWaitingBackgroundJobs(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): ReadonlyArray<BackgroundJobApiItem> {
  return getJobsNewlyMatching(previous, next, isWaiting);
}
