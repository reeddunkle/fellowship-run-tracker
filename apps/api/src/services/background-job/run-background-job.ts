import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { BackgroundJobDeferredError } from "@frt/api/errors/background-job-error.ts";
import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";
import { pruneLogFiles } from "@frt/api/logging/prune-log-files.ts";
import { HIDDEN_BACKGROUND_JOB_QUEUE_NAMES } from "@frt/api/services/background-job/background-job-queues.ts";
import { type BackgroundJob } from "@frt/api/services/background-job/background-job-schema.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { pruneFellowshipLogsCache } from "@frt/api/services/fellowship-logs/cache/prune-fellowship-logs-cache.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";

const IMPORT_RETRY_SCHEDULE = Schedule.exponential("1 second");
const IMPORT_RETRY_TIMES = 2;

type RunBackgroundJobOptions = {
  readonly reportProgress: (fraction: number) => E.Effect<void>;
};

export const runBackgroundJob = E.fn("BackgroundJobService.runBackgroundJob")(
  function* (job: BackgroundJob, { reportProgress }: RunBackgroundJobOptions) {
    const backgroundJobDAO = yield* BackgroundJobDAO;
    const dungeonRunRepository = yield* DungeonRunRepository;
    const fellowshipLogsDungeonRunImporter =
      yield* FellowshipLogsDungeonRunImporter;

    return yield* Match.value(job).pipe(
      Match.tag(
        "ImportFellowshipLogsDungeonRun",
        ({ fightId, isOwnRun, reportCode }) => {
          return fellowshipLogsDungeonRunImporter
            .importReport({
              fightId,
              isOwnRun,
              onProgress: reportProgress,
              reportCode,
            })
            .pipe(
              E.retry({
                schedule: IMPORT_RETRY_SCHEDULE,
                times: IMPORT_RETRY_TIMES,
                while: (error) => {
                  return (
                    error._tag === "FellowshipLogsRequestError" ||
                    error._tag === "FellowshipLogsReportChangedError"
                  );
                },
              }),
              E.catchTag("FellowshipLogsRateLimitExceededError", (error) => {
                return E.fail(
                  new BackgroundJobDeferredError({
                    availableAt: error.resetsAt,
                    reason: error,
                  }),
                );
              }),
              E.catchTag(
                "FellowshipLogsDungeonRunImportAlreadyImportedError",
                ({ dungeonRunId }) => {
                  return E.logInfo(
                    "Fellowship Logs run was already imported; marking the job succeeded.",
                    { dungeonRunId },
                  ).pipe(E.as({ dungeonRunId }));
                },
              ),
              E.map(({ dungeonRunId }): Schema.Json => {
                return { dungeonRunId };
              }),
            );
        },
      ),
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
            E.as(null),
          );
      }),
      Match.tag("PruneFinishedBackgroundJobs", ({ finishedBefore }) => {
        return E.gen(function* () {
          yield* backgroundJobDAO.deleteFinishedBefore({
            finishedBefore,
            statuses: ["SUCCEEDED"],
          });

          if (A.isReadonlyArrayNonEmpty(HIDDEN_BACKGROUND_JOB_QUEUE_NAMES)) {
            yield* backgroundJobDAO.deleteFinishedBefore({
              finishedBefore,
              queues: HIDDEN_BACKGROUND_JOB_QUEUE_NAMES,
              statuses: ["FAILED"],
            });
          }

          yield* backgroundJobDAO.incrementalVacuum();

          return null;
        });
      }),
      Match.tag("PruneFellowshipLogsCache", () => {
        return pruneFellowshipLogsCache.pipe(E.as(null));
      }),
      Match.tag("PruneLogFiles", () => {
        return pruneLogFiles({
          currentLogFilePath: SESSION_LOG_FILE_PATH,
          directory: appPaths.logs,
        }).pipe(E.as(null));
      }),
      Match.exhaustive,
    );
  },
);
