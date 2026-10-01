import { CatchBoundary } from "@tanstack/react-router";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Suspense } from "react";

import { Section, SectionTitle } from "@frt/ui/composites/section.tsx";
import {
  Stat,
  StatLabel,
  StatList,
  StatValue,
} from "@frt/ui/composites/stat-list.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { Card, CardContent } from "@frt/ui/primitives/card.tsx";
import { Skeleton } from "@frt/ui/primitives/skeleton.tsx";
import { Spinner } from "@frt/ui/primitives/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@frt/ui/primitives/tooltip.tsx";

import { getAnalyticsItems } from "@/renderer/api/fellowship-logs/fellowship-logs-analytics-items.ts";
import { useFellowshipLogsAnalyticsSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";
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
      <CardContent>
        <Section>
          <CatchBoundary
            errorComponent={AnalyticsLoadError}
            getResetKey={() => "fellowship-logs-analytics"}
            onCatch={logBoundaryError}
          >
            <Suspense fallback={<AnalyticsSkeleton />}>
              <AnalyticsContent />
            </Suspense>
          </CatchBoundary>
        </Section>
      </CardContent>
    </Card>
  );
}

function AnalyticsTitle() {
  return <SectionTitle>Cache analytics</SectionTitle>;
}

function AnalyticsLoadError() {
  return (
    <>
      <AnalyticsTitle />
      <StatusText size="xs" variant="destructive">
        <XCircleIcon />
        Failed to load cache analytics.
      </StatusText>
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
        <StatList aria-hidden="true" className="grid-cols-4">
          {ANALYTICS_LABELS.map((label) => (
            <Stat key={label}>
              <StatLabel>{label}</StatLabel>
              <StatValue>
                <Skeleton className="h-5 w-12" />
              </StatValue>
            </Stat>
          ))}
        </StatList>
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
      <StatList className="grid-cols-4">
        {getAnalyticsItems(summary).map(({ label, value }) => {
          return (
            <Stat key={label}>
              <StatLabel>{label}</StatLabel>
              <StatValue>{value}</StatValue>
            </Stat>
          );
        })}
      </StatList>
      <p className="text-xs text-muted-foreground">
        {summary.trackingSinceMilliseconds === null
          ? "Nothing tracked yet. Stats appear after your first Fellowship Logs request."
          : `Points are approximate. Tracking since ${formatRelativeDateTimeFromMilliseconds(summary.trackingSinceMilliseconds)}.`}
      </p>
    </>
  );
}
