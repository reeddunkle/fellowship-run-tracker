import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Match from "effect/Match";

import { type BackgroundJob } from "@frt/api/services/background-jobs/background-job-schema.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";

export const runBackgroundJob = E.fn("BackgroundJobs.runBackgroundJob")(
  function* (job: BackgroundJob) {
    const dungeonRunRepository = yield* DungeonRunRepository;

    return yield* Match.value(job).pipe(
      Match.tag("InterruptUnfinishedDungeonRuns", ({ createdBefore }) => {
        return dungeonRunRepository
          .interruptUnfinishedLocal({ createdBefore })
          .pipe(
            E.flatMap((dungeonRunIds) => {
              return A.isReadonlyArrayNonEmpty(dungeonRunIds)
                ? E.logInfo(
                    "Interrupted dungeon runs left unfinished by a previous session.",
                    { dungeonRunIds },
                  )
                : E.void;
            }),
          );
      }),
      Match.exhaustive,
    );
  },
);
