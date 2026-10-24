import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
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
import { withExpectedFellowshipLogsConnectionIdentity } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import { pruneFellowshipLogsGatewayCache } from "@frt/api/services/fellowship-logs-gateway/cache/prune-fellowship-logs-gateway-cache.ts";
import { withFellowshipLogsGatewayPointsSpent } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { getFellowshipLogsGatewayWait } from "@frt/api/services/fellowship-logs-gateway/get-fellowship-logs-gateway-wait.ts";
import { FellowshipLogsImportCost } from "@frt/api/services/fellowship-logs-import-cost/fellowship-logs-import-cost-service.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { DungeonRunStore } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";

const IMPORT_RETRY_SCHEDULE = Schedule.exponential("1 second");
const IMPORT_RETRY_TIMES = 2;

type RunBackgroundJobOptions = {
  readonly bindingKey: string | null;
  readonly jobId: BackgroundJobId;
  readonly reportProgress: (fraction: number) => E.Effect<void>;
};

const makeBackgroundJobRunner = E.gen(function* () {
  const backgroundJobDAO = yield* BackgroundJobDAO;
  const dungeonRunStore = yield* DungeonRunStore;
  const fellowshipLogsDungeonRunImporter =
    yield* FellowshipLogsDungeonRunImporter;
  const fellowshipLogsImportCost = yield* FellowshipLogsImportCost;
  const maintenanceContext = yield* E.context<
    FellowshipLogsResponseDAO | FileSystem.FileSystem | Path.Path
  >();

  const run = E.fn("BackgroundJobRunner.run")(function* (
    job: BackgroundJobPayload,
    { bindingKey, jobId, reportProgress }: RunBackgroundJobOptions,
  ) {
    return yield* Match.value(job).pipe(
      Match.tag(
        "ImportFellowshipLogsDungeonRun",
        ({ fightId, isOwnRun, lookupWorkflowId, reportCode }) => {
          return fellowshipLogsDungeonRunImporter
            .importReport({
              fightId,
              isOwnRun,
              onProgress: reportProgress,
              reportCode,
            })
            .pipe(
              withExpectedFellowshipLogsConnectionIdentity(bindingKey),
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
              fellowshipLogsImportCost.measure({
                fightId,
                jobId,
                ...(lookupWorkflowId === undefined ? {} : { lookupWorkflowId }),
                reportCode,
              }),
              E.map(([result]) => {
                return result;
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
              E.mapError((error) => {
                return Option.match(getFellowshipLogsGatewayWait(error), {
                  onNone: () => error,
                  onSome: ({ availableAt, cause, waitingReason }) => {
                    return new BackgroundJobDeferredError({
                      availableAt,
                      reason: cause,
                      waitingReason,
                    });
                  },
                });
              }),
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
        return dungeonRunStore.interruptUnfinishedLocal({ createdBefore }).pipe(
          E.flatMap((dungeonRunIds) => {
            return A.isReadonlyArrayNonEmpty(dungeonRunIds)
              ? E.logInfo(
                  "Interrupted dungeon runs left unfinished by a previous session.",
                  { dungeonRunCount: dungeonRunIds.length },
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
    Layer.provide(DungeonRunStore.layer),
    Layer.provide(FellowshipLogsDungeonRunImporter.layer),
    Layer.provide(FellowshipLogsImportCost.layer),
    Layer.provide(NodePlatformLayer),
  );
}
