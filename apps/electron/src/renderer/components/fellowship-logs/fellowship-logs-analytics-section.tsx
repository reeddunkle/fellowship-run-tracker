import { CatchBoundary } from "@tanstack/react-router";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@frt/ui/button.tsx";
import { Card, CardContent } from "@frt/ui/card.tsx";
import { Skeleton } from "@frt/ui/skeleton.tsx";
import { Spinner } from "@frt/ui/spinner.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@frt/ui/tooltip.tsx";

import { getAnalyticsItems } from "@/renderer/api/fellowship-logs/fellowship-logs-analytics-items.ts";
import { useFellowshipLogsAnalyticsSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { formatRelativeDateTimeFromMilliseconds } from "@/util/format-date-time.ts";

const ANALYTICS_LABELS = [
  "Cache hits",
  "Hit rate",
  "Points saved",
  "Points spent",
];

export function FellowshipLogsAnalyticsSection() {
  return (
    <Card>
      <CardContent className="grid gap-2">
        <CatchBoundary
          errorComponent={AnalyticsLoadError}
          getResetKey={() => "fellowship-logs-analytics"}
        >
          <Suspense fallback={<AnalyticsSkeleton />}>
            <AnalyticsContent />
          </Suspense>
        </CatchBoundary>
      </CardContent>
    </Card>
  );
}

function AnalyticsTitle() {
  return <p className="text-sm font-medium">Cache analytics</p>;
}

function AnalyticsLoadError() {
  return (
    <>
      <AnalyticsTitle />
      <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <XCircleIcon className="size-3.5" />
        Failed to load cache analytics.
      </div>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <AnalyticsTitle />
      <section
        aria-busy="true"
        aria-label="Loading cache analytics"
        aria-live="polite"
      >
        <div aria-hidden="true" className="grid grid-cols-4 gap-4 text-sm">
          {ANALYTICS_LABELS.map((label) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function AnalyticsContent() {
  const {
    data: summary,
    isFetching,
    refetch,
  } = useFellowshipLogsAnalyticsSuspense();

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <AnalyticsTitle />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Refresh cache analytics"
                disabled={isFetching}
                onClick={() => {
                  void refetch();
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            {isFetching ? <Spinner /> : <RefreshCwIcon />}
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
      <dl className="grid grid-cols-4 gap-4 text-sm">
        {getAnalyticsItems(summary).map(({ label, value }) => {
          return (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-xs text-muted-foreground">
        {summary.trackingSinceMilliseconds === null
          ? "Nothing tracked yet. Stats appear after your first Fellowship Logs request."
          : `Points are approximate. Tracking since ${formatRelativeDateTimeFromMilliseconds(summary.trackingSinceMilliseconds)}.`}
      </p>
    </>
  );
}
