import { CatchBoundary } from "@tanstack/react-router";
import { Suspense } from "react";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { Item, ItemContent, ItemGroup } from "@frt/ui/item.tsx";
import { Skeleton } from "@frt/ui/skeleton.tsx";

import { type BackgroundJobCategoryId } from "@/renderer/api/background-job/background-job-categories.ts";
import { useBackgroundJobCategorySuspense } from "@/renderer/api/background-job/background-job-queries.ts";

import { getBackgroundJobQueueContext } from "./background-job-descriptions.ts";
import { BackgroundJobRow } from "./background-job-row.tsx";

// [TODO] Research best way to "auto-remove" completed items (e.g. just filter here?)
function BackgroundJobItems({
  jobs,
}: {
  readonly jobs: ReadonlyArray<BackgroundJobApiItem>;
}) {
  const { isQueueWaiting, queuedJobIds } = getBackgroundJobQueueContext(jobs);

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

function BackgroundJobListLoadError() {
  return <p className="text-sm text-destructive">Failed to load jobs.</p>;
}

function BackgroundJobListSkeleton() {
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

type BackgroundJobCategoryListProps = {
  readonly categoryId: BackgroundJobCategoryId;
  readonly emptyMessage?: string | undefined;
};

function BackgroundJobCategoryListContent({
  categoryId,
  emptyMessage,
}: BackgroundJobCategoryListProps) {
  const jobs = useBackgroundJobCategorySuspense(categoryId);

  if (jobs.length > 0) {
    return <BackgroundJobItems jobs={jobs} />;
  }

  return emptyMessage === undefined ? null : (
    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  );
}

export function BackgroundJobCategoryList({
  categoryId,
  emptyMessage,
}: BackgroundJobCategoryListProps) {
  return (
    <CatchBoundary
      errorComponent={BackgroundJobListLoadError}
      getResetKey={() => categoryId}
    >
      <Suspense fallback={<BackgroundJobListSkeleton />}>
        <BackgroundJobCategoryListContent
          categoryId={categoryId}
          emptyMessage={emptyMessage}
        />
      </Suspense>
    </CatchBoundary>
  );
}
