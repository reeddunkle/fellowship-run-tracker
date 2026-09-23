import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";

import { type BackgroundJob } from "@frt/api/services/background-jobs/background-job-schema.ts";

export function getBackgroundJobIdempotencyKey(
  job: BackgroundJob,
): string | undefined {
  return Match.value(job).pipe(
    Match.tag("InterruptUnfinishedDungeonRuns", ({ createdBefore }) => {
      return `interrupt-unfinished-dungeon-runs/${DateTime.toEpochMillis(createdBefore)}`;
    }),
    Match.exhaustive,
  );
}
