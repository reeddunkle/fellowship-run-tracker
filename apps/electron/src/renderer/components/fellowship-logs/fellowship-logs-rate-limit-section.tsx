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

import { useRefreshFellowshipLogsRateLimitData } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useFellowshipLogsRateLimitDataSuspense } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";

import { FellowshipLogsRateLimitData } from "./fellowship-logs-rate-limit-data.tsx";
import { FellowshipLogsRateLimitRefreshErrorMessage } from "./fellowship-logs-rate-limit-refresh-error-message.tsx";

export function FellowshipLogsRateLimitSection() {
  return (
    <Card>
      <CardContent>
        <Section>
          <SectionTitle>Rate limit</SectionTitle>
          <CatchBoundary
            errorComponent={RateLimitLoadError}
            getResetKey={() => "rate-limit-data"}
            onCatch={logBoundaryError}
          >
            <Suspense fallback={<RateLimitDataSkeleton />}>
              <RateLimitContent />
            </Suspense>
          </CatchBoundary>
        </Section>
      </CardContent>
    </Card>
  );
}

function RateLimitLoadError() {
  return (
    <StatusText size="xs" variant="destructive">
      <XCircleIcon />
      Failed to load rate limit data.
    </StatusText>
  );
}

function RateLimitDataSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading rate limit data"
      aria-live="polite"
    >
      <StatList aria-hidden="true" className="grid-cols-3">
        {["Points left", "Hourly limit", "Resets in"].map((label) => (
          <Stat key={label}>
            <StatLabel>{label}</StatLabel>
            <StatValue>
              <Skeleton className="h-5 w-12" />
            </StatValue>
          </Stat>
        ))}
      </StatList>
    </section>
  );
}

function RateLimitContent() {
  const rateLimitData = useFellowshipLogsRateLimitDataSuspense();
  const refreshMutation = useRefreshFellowshipLogsRateLimitData();

  return (
    <>
      {refreshMutation.isError ? (
        <StatusText size="xs" variant="destructive">
          <XCircleIcon />
          <FellowshipLogsRateLimitRefreshErrorMessage
            error={refreshMutation.error}
          />
        </StatusText>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {rateLimitData === null ? (
          <p className="text-xs text-muted-foreground">
            No recently queried rate limit data yet.
          </p>
        ) : (
          <div className="flex-1">
            <FellowshipLogsRateLimitData rateLimitData={rateLimitData} />
          </div>
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
