import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";

export const BACKGROUND_JOB_TOAST_LINGER_MILLISECONDS = 5_000;

export function isBackgroundJobActive(job: BackgroundJobApiItem): boolean {
  return (
    job.status === "QUEUED" ||
    job.status === "RUNNING" ||
    job.status === "WAITING"
  );
}

function getToastExpiryMilliseconds(
  job: BackgroundJobApiItem,
): number | undefined {
  return isBackgroundJobActive(job) || job.finishedAtMilliseconds === null
    ? undefined
    : job.finishedAtMilliseconds + BACKGROUND_JOB_TOAST_LINGER_MILLISECONDS;
}

export function getToastVisibleBackgroundJobs(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  nowMilliseconds: number,
): ReadonlyArray<BackgroundJobApiItem> {
  return jobs.filter((job) => {
    if (isBackgroundJobActive(job)) {
      return true;
    }

    const expiresAtMilliseconds = getToastExpiryMilliseconds(job);

    return (
      expiresAtMilliseconds !== undefined &&
      nowMilliseconds < expiresAtMilliseconds
    );
  });
}

export function getNextToastExpiryMilliseconds(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
  nowMilliseconds: number,
): number | undefined {
  const upcomingExpiries = jobs.flatMap((job) => {
    const expiresAtMilliseconds = getToastExpiryMilliseconds(job);

    return expiresAtMilliseconds !== undefined &&
      expiresAtMilliseconds > nowMilliseconds
      ? [expiresAtMilliseconds]
      : [];
  });

  return upcomingExpiries.length === 0
    ? undefined
    : Math.min(...upcomingExpiries);
}
