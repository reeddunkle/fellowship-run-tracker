import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";

import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";

export function getBackgroundJobIdempotencyKey(
  job: BackgroundJobPayload,
): string | null {
  return Match.value(job).pipe(
    Match.tag("ImportFellowshipLogsDungeonRun", ({ fightId, reportCode }) => {
      return `fellowship-logs-import/${reportCode}/${fightId}`;
    }),
    Match.tag("InterruptUnfinishedDungeonRuns", ({ createdBefore }) => {
      return `interrupt-unfinished-dungeon-runs/${DateTime.toEpochMillis(createdBefore)}`;
    }),
    Match.tag("PruneFellowshipLogsCache", () => {
      return "prune-fellowship-logs-cache";
    }),
    Match.tag("PruneFinishedBackgroundJobs", ({ finishedBefore }) => {
      return `prune-finished-background-jobs/${DateTime.toEpochMillis(finishedBefore)}`;
    }),
    Match.tag("PruneLogFiles", () => {
      return "prune-log-files";
    }),
    Match.exhaustive,
  );
}
