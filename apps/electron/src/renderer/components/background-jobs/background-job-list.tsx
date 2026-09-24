import { CatchBoundary } from "@tanstack/react-router";
import { Suspense } from "react";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { Item, ItemContent, ItemGroup } from "@frt/ui/item.tsx";
import { Skeleton } from "@frt/ui/skeleton.tsx";

import { type BackgroundJobCategoryId } from "@/renderer/api/background-job/background-job-categories.ts";
import { useBackgroundJobCategorySuspense } from "@/renderer/api/background-job/background-job-queries.ts";

import { BackgroundJobRow } from "./background-job-row.tsx";

export function BackgroundJobItems({
  jobs,
}: {
  readonly jobs: ReadonlyArray<BackgroundJobApiItem>;
}) {
  const queuedJobIds = jobs
    .filter((job) => {
      return job.status === "QUEUED";
    })
    .map((job) => {
      return job.id;
    });
  const isQueueWaiting = jobs.some((job) => {
    return job.status === "WAITING";
  });

  return (
    <ItemGroup>
      {jobs.map((job) => (
        <BackgroundJobRow
          isQueueWaiting={isQueueWaiting}
          job={job}
          key={job.id}
          queuePosition={queuedJobIds.indexOf(job.id) + 1}
        />
      ))}
    </ItemGroup>
  );
}

export function BackgroundJobListLoadError() {
  return <p className="text-sm text-destructive">Failed to load jobs.</p>;
}

export function BackgroundJobListSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading jobs" aria-live="polite">
      <Item aria-hidden="true" variant="outline">
        <ItemContent>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </ItemContent>
      </Item>
    </section>
  );
}

function BackgroundJobCategoryListContent({
  categoryId,
}: {
  readonly categoryId: BackgroundJobCategoryId;
}) {
  const jobs = useBackgroundJobCategorySuspense(categoryId);

  return jobs.length === 0 ? null : <BackgroundJobItems jobs={jobs} />;
}

/** [KEEP]
 * One category's jobs, kept live by the background job WebSocket. Renders
 * nothing when the category is empty.
 */
export function BackgroundJobCategoryList({
  categoryId,
}: {
  readonly categoryId: BackgroundJobCategoryId;
}) {
  return (
    <CatchBoundary
      errorComponent={BackgroundJobListLoadError}
      getResetKey={() => categoryId}
    >
      <Suspense fallback={<BackgroundJobListSkeleton />}>
        <BackgroundJobCategoryListContent categoryId={categoryId} />
      </Suspense>
    </CatchBoundary>
  );
}
