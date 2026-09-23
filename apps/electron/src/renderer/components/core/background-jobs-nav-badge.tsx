import * as Match from "effect/Match";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { cn } from "@frt/ui/class-names.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@frt/ui/tooltip.tsx";

import { type BackgroundJobSummary } from "@/renderer/api/background-job/background-job-categories.ts";
import { useBackgroundJobSummary } from "@/renderer/api/background-job/background-job-queries.ts";

function describeRunningJob(job: BackgroundJobApiItem): string {
  const progress =
    job.progress === null ? "" : ` — ${Math.round(job.progress * 100)}%`;

  // The nav shows on pages without the Fellowship catalog, so jobs are named
  // by what's in their payload rather than by dungeon name.
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
}: BackgroundJobSummary): ReadonlyArray<string> {
  return [
    runningJob === undefined ? undefined : describeRunningJob(runningJob),
    queuedCount === 0
      ? undefined
      : `${queuedCount} ${runningJob === undefined ? "" : "more "}queued`,
    failedCount === 0 ? undefined : `${failedCount} failed`,
  ].flatMap((line) => {
    return line === undefined ? [] : [line];
  });
}

/**
 * The number of active jobs (or failed ones, once nothing is active) in a
 * ring that spins while jobs run and turns red after any failure. Hidden when
 * the queue is idle.
 */
export function BackgroundJobsNavBadge() {
  const summary = useBackgroundJobSummary();

  if (summary.state === "idle") {
    return null;
  }

  const isFailed = summary.state === "failed";
  const isActive = summary.activeCount > 0;
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
            isActive && "animate-spin border-t-transparent",
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
