import {
  type BackgroundJobApiItem,
  type BackgroundJobApiSnapshot,
} from "@frt/shared/background-job/background-job-api-schema.ts";

function isFinished(job: BackgroundJobApiItem): boolean {
  return job.status === "SUCCEEDED" || job.status === "FAILED";
}

/**
 * Jobs that are finished in `next` but weren't in `previous`, including jobs
 * `previous` didn't have at all (e.g. the first snapshot after a reconnect).
 */
export function getNewlyFinishedBackgroundJobs(
  previous: BackgroundJobApiSnapshot | undefined,
  next: BackgroundJobApiSnapshot,
): ReadonlyArray<BackgroundJobApiItem> {
  const previousStatuses = new Map(
    (previous?.jobs ?? []).map((job) => {
      return [job.id, job.status] as const;
    }),
  );

  return next.jobs.filter((job) => {
    return isFinished(job) && previousStatuses.get(job.id) !== job.status;
  });
}
