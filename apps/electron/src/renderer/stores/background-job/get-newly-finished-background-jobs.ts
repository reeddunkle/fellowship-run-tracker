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

/**
 * Jobs matching `predicate` in `next` whose status changed since `previous`,
 * including jobs `previous` didn't have at all (e.g. the first snapshot after
 * a reconnect).
 */
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

/** Jobs that are finished in `next` but weren't in `previous`. */
export function getNewlyFinishedBackgroundJobs(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): ReadonlyArray<BackgroundJobApiItem> {
  return getJobsNewlyMatching(previous, next, isFinished);
}

/** Jobs that started waiting (e.g. for Fellowship Logs points) since `previous`. */
export function getNewlyWaitingBackgroundJobs(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): ReadonlyArray<BackgroundJobApiItem> {
  return getJobsNewlyMatching(previous, next, isWaiting);
}
