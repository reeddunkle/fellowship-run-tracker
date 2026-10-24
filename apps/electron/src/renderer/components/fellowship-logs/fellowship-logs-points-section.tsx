import { useQuery } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import * as DateTime from "effect/DateTime";
import { InfoIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";

import { FELLOWSHIP_LOGS_BETA_POINT_POLICY } from "@frt/shared/fellowship-logs/fellowship-logs-beta-point-policy.ts";
import {
  Stat,
  StatLabel,
  StatList,
  StatValue,
} from "@frt/ui/composites/stat-list.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frt/ui/primitives/dialog.tsx";
import { Skeleton } from "@frt/ui/primitives/skeleton.tsx";
import { Spinner } from "@frt/ui/primitives/spinner.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frt/ui/primitives/table.tsx";

import { useRefreshFellowshipLogsRateLimitData } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import {
  formatPoints,
  getImportCostEstimateLines,
  getPointPoolItems,
  getRateLimitExceededMessage,
} from "@/renderer/api/fellowship-logs/fellowship-logs-point-messages.ts";
import {
  useFellowshipLogsImportCostEstimateSuspense,
  useFellowshipLogsPointPoolsSuspense,
} from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

import { getConnectionErrorMessage } from "./connection/get-connection-error-message.ts";

const POOL_LABELS = ["Your account points", "API client points"];

const SUBSCRIPTION_LABELS = {
  GOLD: "Gold",
  PLATINUM: "Platinum",
  SILVER: "Silver",
  UNSUBSCRIBED: "Unsubscribed",
} as const satisfies Record<
  keyof typeof FELLOWSHIP_LOGS_BETA_POINT_POLICY.limitsPerHour,
  string
>;

const EffectiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

const BETA_POLICY_EFFECTIVE_DATE = EffectiveDateFormatter.format(
  DateTime.toEpochMillis(
    DateTime.makeUnsafe(FELLOWSHIP_LOGS_BETA_POINT_POLICY.effectiveDate),
  ),
);

function getRefreshErrorMessage(error: unknown, nowMilliseconds: number) {
  return (
    getRateLimitExceededMessage(error, nowMilliseconds) ??
    getConnectionErrorMessage(error)
  );
}

export function HowPointsWorkButton() {
  return (
    <DialogTrigger
      render={<Button size="xs" type="button" variant="outline" />}
    >
      <InfoIcon />
      How points work
    </DialogTrigger>
  );
}

export function FellowshipLogsPointsDialog({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <Dialog>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Points</DialogTitle>
          <DialogDescription>
            Fellowship Logs gives your account and API clients separate hourly
            point limits.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="@container">
          <div className="flex flex-col gap-4">
            <CatchBoundary
              errorComponent={PointPoolsLoadError}
              getResetKey={() => "fellowship-logs-point-pools"}
              onCatch={logBoundaryError}
            >
              <Suspense fallback={<PointPoolsSkeleton />}>
                <PointPoolsContent />
              </Suspense>
            </CatchBoundary>
            <CatchBoundary
              errorComponent={ImportCostLoadError}
              getResetKey={() => "fellowship-logs-import-cost-estimate"}
              onCatch={logBoundaryError}
            >
              <Suspense fallback={<ImportCostSkeleton />}>
                <ImportCostContent />
              </Suspense>
            </CatchBoundary>
            <BetaPointPolicy />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function PointPoolsLoadError() {
  return (
    <StatusText size="xs" variant="destructive">
      <XCircleIcon />
      Failed to load point data.
    </StatusText>
  );
}

function PointPoolsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading point data"
      aria-live="polite"
    >
      <StatList aria-hidden="true" className="grid-cols-1 @md:grid-cols-2">
        {POOL_LABELS.map((label) => (
          <Stat key={label}>
            <StatLabel>{label}</StatLabel>
            <StatValue>
              <Skeleton className="h-5 w-24" />
            </StatValue>
          </Stat>
        ))}
      </StatList>
    </section>
  );
}

function PointPoolsContent() {
  const pointPools = useFellowshipLogsPointPoolsSuspense();
  const { data: connectionStatus } = useQuery(
    getFellowshipLogsConnectionStatusQueryOptions(),
  );
  const refreshMutation = useRefreshFellowshipLogsRateLimitData();
  const nowMilliseconds = useNowMilliseconds();

  const profile = connectionStatus?.connection?.profile ?? null;

  return (
    <>
      {refreshMutation.isError ? (
        <StatusText size="xs" variant="destructive">
          <XCircleIcon />
          {getRefreshErrorMessage(refreshMutation.error, nowMilliseconds)}
        </StatusText>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        {pointPools === null ? (
          <p className="text-xs text-muted-foreground">
            No point data yet. It appears after your next Fellowship Logs
            request.
          </p>
        ) : (
          <StatList className="flex-1 grid-cols-1 @md:grid-cols-2">
            {getPointPoolItems(pointPools, profile, nowMilliseconds).map(
              ({ isWarning, label, note, resets, value }) => {
                return (
                  <Stat key={label}>
                    <StatLabel>{label}</StatLabel>
                    <StatValue variant={isWarning ? "destructive" : "default"}>
                      {value}
                    </StatValue>
                    {resets === null ? null : (
                      <dd className="text-xs text-muted-foreground">
                        {resets}
                      </dd>
                    )}
                    {note === null ? null : (
                      <dd className="text-xs text-muted-foreground">{note}</dd>
                    )}
                  </Stat>
                );
              },
            )}
          </StatList>
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

function ImportCostTitle() {
  return <h3 className="text-sm font-medium">What an import costs</h3>;
}

function ImportCostLoadError() {
  return (
    <div className="flex flex-col gap-2">
      <ImportCostTitle />
      <StatusText size="xs" variant="destructive">
        <XCircleIcon />
        Failed to load the import cost estimate.
      </StatusText>
    </div>
  );
}

function ImportCostSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading the import cost estimate"
      className="flex flex-col gap-2"
    >
      <ImportCostTitle />
      <Skeleton className="h-4 w-64 max-w-full" />
    </section>
  );
}

function ImportCostContent() {
  const estimate = useFellowshipLogsImportCostEstimateSuspense();
  const lines = getImportCostEstimateLines(estimate);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <ImportCostTitle />
      <p>{lines.latest}</p>
      {lines.range === null ? null : <p>{lines.range}</p>}
      <ul className="list-disc pl-5 text-muted-foreground">
        <li>Looking up a run can spend points.</li>
        <li>
          A finished import shows exactly what it cost, including the lookup.
        </li>
        <li>Importing a report that's already cached may use no points.</li>
      </ul>
      <p className="text-muted-foreground">
        Example, not an average: if an import costs 40 points, 400 points an
        hour cover about 10 imports.
      </p>
    </div>
  );
}

function BetaPointPolicy() {
  const { limitsPerHour, sourceUrl } = FELLOWSHIP_LOGS_BETA_POINT_POLICY;

  return (
    <div className="flex flex-col gap-2 text-xs">
      <h3 className="text-sm font-medium">
        Hourly limits by subscription (beta)
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subscription</TableHead>
            <TableHead>Your account points</TableHead>
            <TableHead>API client points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(["UNSUBSCRIBED", "SILVER", "GOLD", "PLATINUM"] as const).map(
            (subscription) => {
              const limits = limitsPerHour[subscription];

              return (
                <TableRow key={subscription}>
                  <TableCell>{SUBSCRIPTION_LABELS[subscription]}</TableCell>
                  <TableCell>{formatPoints(limits.USER)}</TableCell>
                  <TableCell>{formatPoints(limits.APPLICATION)}</TableCell>
                </TableRow>
              );
            },
          )}
        </TableBody>
      </Table>
      <p className="text-muted-foreground">
        Official limits effective {BETA_POLICY_EFFECTIVE_DATE}. Fellowship Logs
        is still testing them and may change them.{" "}
        <a
          className="underline underline-offset-2"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Read the announcement
        </a>
      </p>
    </div>
  );
}
