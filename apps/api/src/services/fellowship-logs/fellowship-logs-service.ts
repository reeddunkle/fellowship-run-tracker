import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  BackgroundJobQueueError,
  type BackgroundJobQueueNotFoundError,
} from "@frt/api/errors/background-job-queue-error.ts";
import {
  type FellowshipLogsConnectionError,
  FellowshipLogsNotConnectedError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { createImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/api/services/background-job/create-background-job-api-response.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import {
  createFellowshipLogsDungeonRunMetadataApiResponse,
  createFellowshipLogsImportedDungeonRunApiResponse,
  createFellowshipLogsPointPoolsApiResponse,
  createFellowshipLogsRateLimitDataApiResponse,
} from "@frt/api/services/fellowship-logs/create-fellowship-logs-api-response.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { getFellowshipLogsConnectionIdentity } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import { FellowshipLogsConnection } from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  FellowshipLogsGateway,
  type FellowshipLogsGatewayRequestOperationError,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { FellowshipLogsImportCost } from "@frt/api/services/fellowship-logs-import-cost/fellowship-logs-import-cost-service.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@frt/db/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { type FellowshipLogsRequestDAOError } from "@frt/db/errors/fellowship-logs-request-dao-error.ts";
import {
  DungeonRunStore,
  type DungeonRunStoreError,
} from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type ImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import {
  type FellowshipLogsApiAnalyticsSummary,
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiLastKnownRateLimitData,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
  type FellowshipLogsApiQueueDungeonRunImportResult,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import {
  type FellowshipLogsApiImportCostEstimate,
  type FellowshipLogsApiPointPools,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

export type QueueFellowshipLogsDungeonRunImportError =
  | BackgroundJobQueueError
  | FellowshipLogsConnectionError
  | FellowshipLogsDungeonRunDAOError
  | FellowshipLogsDungeonRunImportAlreadyImportedError
  | FellowshipLogsNotConnectedError;

export type ResumeImportJobWithCurrentConnectionError =
  | BackgroundJobQueueError
  | BackgroundJobQueueNotFoundError
  | FellowshipLogsConnectionError
  | FellowshipLogsNotConnectedError;

type ResumeImportJobWithCurrentConnectionOptions = {
  readonly jobId: BackgroundJobId;
};

type DeleteImportedDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

export type FellowshipLogsShape = {
  readonly getAnalyticsSummary: () => E.Effect<
    FellowshipLogsApiAnalyticsSummary,
    FellowshipLogsRequestDAOError
  >;

  readonly deleteImportedDungeonRun: (
    options: DeleteImportedDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly getDungeonRunMetadata: (
    options: FellowshipLogsApiDungeonRunReference,
  ) => E.Effect<
    FellowshipLogsApiDungeonRunMetadata,
    | FellowshipLogsConnectionError
    | FellowshipLogsGatewayRequestOperationError
    | FellowshipLogsNotConnectedError
  >;

  readonly getImportCostEstimate: () => E.Effect<FellowshipLogsApiImportCostEstimate>;

  readonly getImportedDungeonRuns: () => E.Effect<
    FellowshipLogsApiImportedDungeonRunList,
    DungeonRunStoreError
  >;

  readonly getPointPools: () => E.Effect<
    FellowshipLogsApiPointPools,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly getRateLimitData: () => E.Effect<
    FellowshipLogsApiLastKnownRateLimitData,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly resumeImportJobWithCurrentConnection: (
    options: ResumeImportJobWithCurrentConnectionOptions,
  ) => E.Effect<
    ImportFellowshipLogsDungeonRunBackgroundJobApiItem,
    ResumeImportJobWithCurrentConnectionError
  >;

  readonly queueDungeonRunImport: (
    options: FellowshipLogsApiQueueDungeonRunImportOptions,
  ) => E.Effect<
    FellowshipLogsApiQueueDungeonRunImportResult,
    QueueFellowshipLogsDungeonRunImportError
  >;
};

const makeFellowshipLogs = E.gen(function* () {
  const analytics = yield* FellowshipLogsAnalytics;
  const backgroundJobQueue = yield* BackgroundJobQueue;
  const connection = yield* FellowshipLogsConnection;
  const dungeonRunStore = yield* DungeonRunStore;
  const fellowshipLogsGateway = yield* FellowshipLogsGateway;
  const importCost = yield* FellowshipLogsImportCost;

  const deleteImportedDungeonRun: FellowshipLogsShape["deleteImportedDungeonRun"] =
    E.fn("FellowshipLogs.deleteImportedDungeonRun")(function* (options) {
      return yield* dungeonRunStore.delete(options);
    });

  const getDungeonRunMetadata: FellowshipLogsShape["getDungeonRunMetadata"] =
    E.fn("FellowshipLogs.getDungeonRunMetadata")(function* (options) {
      return yield* connection.withRequestLease(
        E.gen(function* () {
          const summary = yield* connection.getSummary();

          if (Option.isNone(summary)) {
            return yield* new FellowshipLogsNotConnectedError();
          }

          const metadata =
            yield* fellowshipLogsGateway.getDungeonRunMetadata(options);
          const lookupWorkflowId = yield* importCost.recordLookupWorkflow({
            ...metadata.workflowCost,
            connectionGeneration: summary.value.generation,
            fightId: options.fightId,
            reportCode: options.reportCode,
          });

          return createFellowshipLogsDungeonRunMetadataApiResponse(
            metadata,
            lookupWorkflowId,
          );
        }),
      );
    });

  const getImportedDungeonRuns: FellowshipLogsShape["getImportedDungeonRuns"] =
    E.fn("FellowshipLogs.getImportedDungeonRuns")(function* () {
      const rows = yield* dungeonRunStore.listFellowshipLogsRuns();

      return rows.map(createFellowshipLogsImportedDungeonRunApiResponse);
    });

  const getRateLimitData: FellowshipLogsShape["getRateLimitData"] = E.fn(
    "FellowshipLogs.getRateLimitData",
  )(function* () {
    const rateLimitData = yield* fellowshipLogsGateway.getRateLimitData({
      force: true,
    });

    return createFellowshipLogsRateLimitDataApiResponse(rateLimitData);
  });

  const getPointPools: FellowshipLogsShape["getPointPools"] = E.fn(
    "FellowshipLogs.getPointPools",
  )(function* () {
    const rateLimitData = yield* fellowshipLogsGateway.getRateLimitData();
    const nowMilliseconds = yield* Clock.currentTimeMillis;

    return createFellowshipLogsPointPoolsApiResponse(
      rateLimitData,
      nowMilliseconds,
    );
  });

  const getImportCostEstimate: FellowshipLogsShape["getImportCostEstimate"] =
    E.fn("FellowshipLogs.getImportCostEstimate")(function* () {
      const estimate = yield* importCost.getEstimate({ includesLookup: true });

      return Option.getOrNull(estimate);
    });

  const queueDungeonRunImport: FellowshipLogsShape["queueDungeonRunImport"] =
    E.fn("FellowshipLogs.queueDungeonRunImport")(function* (options) {
      const summary = yield* connection.getSummary();

      if (Option.isNone(summary)) {
        return yield* new FellowshipLogsNotConnectedError();
      }

      const existing = yield* dungeonRunStore.getFellowshipLogsRun({
        fightId: options.fightId,
        reportCode: options.reportCode,
      });

      if (Option.isSome(existing)) {
        return yield* new FellowshipLogsDungeonRunImportAlreadyImportedError({
          dungeonRunId: existing.value.dungeonRunId,
          fightId: options.fightId,
          reportCode: options.reportCode,
        });
      }

      const { job, wasAlreadyQueued } = yield* backgroundJobQueue.offer(
        {
          _tag: "ImportFellowshipLogsDungeonRun",
          ...options,
        },
        {
          bindingKey: getFellowshipLogsConnectionIdentity(summary.value),
        },
      );

      if (!wasAlreadyQueued && options.lookupWorkflowId !== undefined) {
        yield* importCost.claimLookupWorkflow({
          connectionGeneration: summary.value.generation,
          fightId: options.fightId,
          jobId: job.id,
          reportCode: options.reportCode,
          workflowId: options.lookupWorkflowId,
        });
      }

      const item = createImportFellowshipLogsDungeonRunBackgroundJobApiItem({
        job,
        progress: null,
      });

      if (Option.isNone(item)) {
        return yield* new BackgroundJobQueueError({
          cause: job,
          operation: "Offer",
        });
      }

      return { job: item.value, wasAlreadyQueued };
    });

  const resumeImportJobWithCurrentConnection: FellowshipLogsShape["resumeImportJobWithCurrentConnection"] =
    E.fn("FellowshipLogs.resumeImportJobWithCurrentConnection")(function* ({
      jobId,
    }) {
      const summary = yield* connection.getSummary();

      if (Option.isNone(summary)) {
        return yield* new FellowshipLogsNotConnectedError();
      }

      const job = yield* backgroundJobQueue.resumeWaitingJob({
        bindingKey: getFellowshipLogsConnectionIdentity(summary.value),
        id: jobId,
        waitingReasons: ["PROFILE_CHANGE_CONFIRMATION_REQUIRED"],
      });
      const item = createImportFellowshipLogsDungeonRunBackgroundJobApiItem({
        job,
        progress: null,
      });

      if (Option.isNone(item)) {
        return yield* new BackgroundJobQueueError({
          cause: job,
          operation: "Resume",
        });
      }

      return item.value;
    });

  return {
    deleteImportedDungeonRun,
    getAnalyticsSummary: analytics.getSummary,
    getDungeonRunMetadata,
    getImportCostEstimate,
    getImportedDungeonRuns,
    getPointPools,
    getRateLimitData,
    queueDungeonRunImport,
    resumeImportJobWithCurrentConnection,
  } satisfies FellowshipLogsShape;
});

export class FellowshipLogs extends Context.Service<
  FellowshipLogs,
  FellowshipLogsShape
>()(
  "@frt/api/services/fellowship-logs/fellowship-logs-service/FellowshipLogs",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipLogs);

  /** [KEEP]
   * Leaves `BackgroundJobQueue` for the application root to provide, since
   * it's the single instance that runs the queue workers.
   */
  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunStore.layer),
    Layer.provide(FellowshipLogsAnalytics.layer),
    Layer.provide(FellowshipLogsGateway.layer),
    Layer.provide(FellowshipLogsImportCost.layer),
  );
}
