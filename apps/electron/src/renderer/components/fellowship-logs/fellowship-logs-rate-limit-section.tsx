import { CatchBoundary } from "@tanstack/react-router";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@frt/ui/button.tsx";
import { Card, CardContent } from "@frt/ui/card.tsx";
import { Skeleton } from "@frt/ui/skeleton.tsx";
import { Spinner } from "@frt/ui/spinner.tsx";

import { useRefreshFellowshipLogsRateLimitData } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useFellowshipLogsRateLimitDataSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";

import { FellowshipLogsRateLimitData } from "./fellowship-logs-rate-limit-data.tsx";
import { FellowshipLogsRateLimitRefreshErrorMessage } from "./fellowship-logs-rate-limit-refresh-error-message.tsx";

export function FellowshipLogsRateLimitSection() {
  return (
    <Card>
      <CardContent className="grid gap-2">
        <p className="text-sm font-medium">Rate limit</p>
        <CatchBoundary
          errorComponent={RateLimitLoadError}
          getResetKey={() => "rate-limit-data"}
        >
          <Suspense fallback={<RateLimitDataSkeleton />}>
            <RateLimitContent />
          </Suspense>
        </CatchBoundary>
      </CardContent>
    </Card>
  );
}

function RateLimitLoadError() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <XCircleIcon className="size-3.5" />
      Failed to load rate limit data.
    </div>
  );
}

function RateLimitDataSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading rate limit data"
      aria-live="polite"
    >
      <div aria-hidden="true" className="grid grid-cols-3 gap-4 text-sm">
        {["Points left", "Hourly limit", "Resets in"].map((label) => (
          <div key={label}>
            <p className="text-muted-foreground">{label}</p>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </section>
  );
}

function RateLimitContent() {
  const rateLimitData = useFellowshipLogsRateLimitDataSuspense();
  const refreshMutation = useRefreshFellowshipLogsRateLimitData();

  return (
    <>
      {refreshMutation.isError ? (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <XCircleIcon className="size-3.5" />
          <FellowshipLogsRateLimitRefreshErrorMessage
            error={refreshMutation.error}
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {rateLimitData === null ? (
          <p className="text-xs text-muted-foreground">
            No recently queried rate limit data yet.
          </p>
        ) : (
          <FellowshipLogsRateLimitData
            className="flex-1"
            rateLimitData={rateLimitData}
          />
        )}
        <Button
          disabled={refreshMutation.isPending}
          onClick={() => {
            refreshMutation.refresh();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {refreshMutation.isPending ? <Spinner /> : <RefreshCwIcon />}
          Fetch latest
        </Button>
      </div>
    </>
  );
}
