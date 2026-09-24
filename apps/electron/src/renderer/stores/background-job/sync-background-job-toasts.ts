import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";

import { isBackgroundJobActive } from "./background-job-toast-visibility.ts";

type BackgroundJobId = BackgroundJobApiItem["id"];

export type BackgroundJobToastType = "error" | "loading" | "success";

type BackgroundJobPhase = "active" | "finished";

export type DismissedBackgroundJobPhases = ReadonlyMap<
  BackgroundJobId,
  BackgroundJobPhase
>;

export function getBackgroundJobPhase(
  job: BackgroundJobApiItem,
): BackgroundJobPhase {
  return isBackgroundJobActive(job) ? "active" : "finished";
}

export function getBackgroundJobToastType(
  job: BackgroundJobApiItem,
): BackgroundJobToastType {
  if (isBackgroundJobActive(job)) {
    return "loading";
  }

  return job.status === "FAILED" ? "error" : "success";
}

// biome-ignore assist/source/useSortedKeys: Listed in rank order (front of the toast stack first).
const TOAST_RANK_BY_STATUS = {
  RUNNING: 0,
  WAITING: 0,
  QUEUED: 1,
  FAILED: 2,
  SUCCEEDED: 2,
} as const satisfies Record<BackgroundJobApiItem["status"], number>;

export function sortBackgroundJobsForToasts<
  Entry extends BackgroundJobToastEntry,
>(entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> {
  return [...entries].sort((a, b) => {
    const rankDifference =
      TOAST_RANK_BY_STATUS[a.job.status] - TOAST_RANK_BY_STATUS[b.job.status];

    return rankDifference === 0
      ? a.job.createdAtMilliseconds - b.job.createdAtMilliseconds
      : rankDifference;
  });
}

function wasRetriedSinceDismissal(
  job: BackgroundJobApiItem,
  dismissedPhase: BackgroundJobPhase,
): boolean {
  return (
    dismissedPhase === "finished" && getBackgroundJobPhase(job) === "active"
  );
}

export function isBackgroundJobToastDismissed(
  job: BackgroundJobApiItem,
  dismissed: DismissedBackgroundJobPhases,
): boolean {
  const dismissedPhase = dismissed.get(job.id);

  return (
    dismissedPhase !== undefined &&
    !wasRetriedSinceDismissal(job, dismissedPhase)
  );
}

export function pruneDismissedBackgroundJobPhases(
  dismissed: DismissedBackgroundJobPhases,
  visibleJobs: ReadonlyArray<BackgroundJobApiItem>,
): DismissedBackgroundJobPhases {
  const visibleJobsById = new Map(
    visibleJobs.map((job) => {
      return [job.id, job] as const;
    }),
  );

  return new Map(
    [...dismissed].filter(([jobId, dismissedPhase]) => {
      const job = visibleJobsById.get(jobId);

      return (
        job !== undefined && !wasRetriedSinceDismissal(job, dismissedPhase)
      );
    }),
  );
}

type BackgroundJobToastEntry = {
  readonly job: BackgroundJobApiItem;
};

type SyncBackgroundJobToastsOptions<Entry extends BackgroundJobToastEntry> = {
  readonly closeToast: (jobId: BackgroundJobId) => void;
  readonly entries: ReadonlyArray<Entry>;
  readonly openJobIds: ReadonlySet<BackgroundJobId>;
  readonly showToast: (entry: Entry, stackOrder: number) => void;
};

export function syncBackgroundJobToasts<Entry extends BackgroundJobToastEntry>({
  closeToast,
  entries,
  openJobIds,
  showToast,
}: SyncBackgroundJobToastsOptions<Entry>): ReadonlySet<BackgroundJobId> {
  const nextJobIds = new Set(
    entries.map(({ job }) => {
      return job.id;
    }),
  );

  const closedJobIds = [...openJobIds].filter((jobId) => {
    return !nextJobIds.has(jobId);
  });

  entries.forEach((entry, stackOrder) => {
    showToast(entry, stackOrder);
  });

  closedJobIds.forEach((jobId) => {
    closeToast(jobId);
  });

  return nextJobIds;
}
