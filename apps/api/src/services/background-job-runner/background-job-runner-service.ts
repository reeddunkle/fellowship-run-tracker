import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import type * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { BackgroundJobDeferredError } from "@frt/api/errors/background-job-error.ts";
import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { SESSION_LOG_FILE_PATH } from "@frt/api/logging/log-file-path.ts";
import { pruneLogFiles } from "@frt/api/logging/prune-log-files.ts";
import { type BackgroundJobPayload } from "@frt/api/services/background-job-queue/background-job-payload-schema.ts";
import { HIDDEN_BACKGROUND_JOB_QUEUE_NAMES } from "@frt/api/services/background-job-queue/background-job-queues.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { pruneFellowshipLogsGatewayCache } from "@frt/api/services/fellowship-logs-gateway/cache/prune-fellowship-logs-gateway-cache.ts";
import { withFellowshipLogsGatewayPointsSpent } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";

const IMPORT_RETRY_SCHEDULE = Schedule.exponential("1 second");
const IMPORT_RETRY_TIMES = 2;

type RunBackgroundJobOptions = {
  readonly reportProgress: (fraction: number) => E.Effect<void>;
};

const makeBackgroundJobRunner = E.gen(function* () {
  const backgroundJobDAO = yield* BackgroundJobDAO;
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogsDungeonRunImporter =
    yield* FellowshipLogsDungeonRunImporter;
  const maintenanceContext = yield* E.context<
    FellowshipLogsResponseDAO | FileSystem.FileSystem | Path.Path
  >();

  const run = E.fn("BackgroundJobRunner.run")(function* (
    job: BackgroundJobPayload,
    { reportProgress }: RunBackgroundJobOptions,
  ) {
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
                    error._tag === "FellowshipLogsGatewayRequestError" ||
                    error._tag === "FellowshipLogsGatewayReportChangedError"
                  );
                },
              }),
              E.catchTag(
                "FellowshipLogsGatewayRateLimitExceededError",
                (error) => {
                  return E.fail(
                    new BackgroundJobDeferredError({
                      availableAt: error.resetsAt,
                      reason: error,
                    }),
                  );
                },
              ),
              E.catchTag(
                "FellowshipLogsDungeonRunImportAlreadyImportedError",
                ({ dungeonRunId }) => {
                  return E.logInfo(
                    "Fellowship Logs run was already imported; marking the job succeeded.",
                    { dungeonRunId },
                  ).pipe(E.as({ dungeonRunId }));
                },
              ),
              withFellowshipLogsGatewayPointsSpent,
              E.map(([{ dungeonRunId }, pointsSpent]): Schema.Json => {
                return {
                  approximatePointsSpent: Math.round(pointsSpent),
                  dungeonRunId,
                };
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
        return pruneFellowshipLogsGatewayCache.pipe(
          E.as(null),
          E.provideContext(maintenanceContext),
        );
      }),
      Match.tag("PruneLogFiles", () => {
        return pruneLogFiles({
          currentLogFilePath: SESSION_LOG_FILE_PATH,
          directory: appPaths.logs,
        }).pipe(E.as(null), E.provideContext(maintenanceContext));
      }),
      Match.exhaustive,
    );
  });

  return {
    run,
  };
});

export type BackgroundJobRunnerShape = E.Success<
  typeof makeBackgroundJobRunner
>;

export class BackgroundJobRunner extends Context.Service<
  BackgroundJobRunner,
  BackgroundJobRunnerShape
>()(
  "@frt/api/services/background-job-runner/background-job-runner-service/BackgroundJobRunner",
) {
  static readonly layerNoDeps = Layer.effect(this, makeBackgroundJobRunner);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(BackgroundJobDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogsDungeonRunImporter.layer),
    Layer.provide(NodePlatformLayer),
  );
}
