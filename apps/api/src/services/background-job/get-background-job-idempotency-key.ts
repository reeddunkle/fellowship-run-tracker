import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";

import { type BackgroundJob } from "@frt/api/services/background-job/background-job-schema.ts";

/*
 * Jobs with the same key share one queued or running job. `null` means every
 * offer creates a new job.
 */
export function getBackgroundJobIdempotencyKey(
  job: BackgroundJob,
): string | null {
  return Match.value(job).pipe(
    Match.tag("ImportFellowshipLogsDungeonRun", ({ fightId, reportCode }) => {
      return `fellowship-logs-import/${reportCode}/${fightId}`;
    }),
    Match.tag("InterruptUnfinishedDungeonRuns", ({ createdBefore }) => {
      return `interrupt-unfinished-dungeon-runs/${DateTime.toEpochMillis(createdBefore)}`;
    }),
    Match.tag("PruneFinishedBackgroundJobs", ({ finishedBefore }) => {
      return `prune-finished-background-jobs/${DateTime.toEpochMillis(finishedBefore)}`;
    }),
    // Pruning only depends on the log directory at run time, so one pending
    // job covers every request.
    Match.tag("PruneLogFiles", () => {
      return "prune-log-files";
    }),
    Match.exhaustive,
  );
}
