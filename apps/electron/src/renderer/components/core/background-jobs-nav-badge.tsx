import * as Match from "effect/Match";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { cn } from "@frt/ui/class-names.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@frt/ui/tooltip.tsx";

import { type BackgroundJobSummary } from "@/renderer/api/background-job/background-job-categories.ts";
import { useBackgroundJobSummary } from "@/renderer/api/background-job/background-job-queries.ts";

function describeRunningJob(job: BackgroundJobApiItem): string {
  const progress =
    job.progress === null ? "" : ` — ${Math.round(job.progress * 100)}%`;

  const name = Match.value(job).pipe(
    Match.discriminatorsExhaustive("kind")({
      ImportFellowshipLogsDungeonRun: ({ payload }) => {
        return `Importing ${payload.reportCode} · fight ${payload.fightId}`;
      },
    }),
  );

  return `${name}${progress}`;
}

function getSummaryLines({
  failedCount,
  queuedCount,
  runningJob,
  waitingCount,
}: BackgroundJobSummary): ReadonlyArray<string> {
  return [
    runningJob === undefined ? undefined : describeRunningJob(runningJob),
    waitingCount === 0
      ? undefined
      : `${waitingCount} waiting for Fellowship Logs points`,
    queuedCount === 0
      ? undefined
      : `${queuedCount} ${runningJob === undefined ? "" : "more "}queued`,
    failedCount === 0 ? undefined : `${failedCount} failed`,
  ].flatMap((line) => {
    return line === undefined ? [] : [line];
  });
}

export function BackgroundJobsNavBadge() {
  const summary = useBackgroundJobSummary();

  if (summary.state === "idle") {
    return null;
  }

  const isFailed = summary.state === "failed";
  const isActive = summary.activeCount > 0;
  const isSpinning =
    summary.runningJob !== undefined ||
    (summary.queuedCount > 0 && summary.waitingCount === 0);
  const count = isActive ? summary.activeCount : summary.failedCount;
  const lines = getSummaryLines(summary);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "relative inline-flex size-5 items-center justify-center text-[10px] font-semibold tabular-nums",
              isFailed && "text-destructive",
            )}
          />
        }
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full border-2",
            isFailed ? "border-destructive" : "border-primary",
            isSpinning && "animate-spin border-t-transparent",
          )}
        />
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">{lines.join(", ")}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="grid gap-0.5">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
