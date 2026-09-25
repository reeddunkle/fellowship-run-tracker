import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { BackgroundJobQueueError } from "@frt/api/errors/background-job-queue-error.ts";
import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { createImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/api/services/background-job/create-background-job-api-response.ts";
import { BackgroundJobQueue } from "@frt/api/services/background-job-queue/background-job-queue-service.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  createFellowshipLogsDungeonRunMetadataApiResponse,
  createFellowshipLogsImportedDungeonRunApiResponse,
  createFellowshipLogsRateLimitDataApiResponse,
} from "@frt/api/services/fellowship-logs/create-fellowship-logs-api-response.ts";
import {
  FellowshipLogsGateway,
  type FellowshipLogsGatewayRequestOperationError,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@frt/db/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiLastKnownRateLimitData,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
  type FellowshipLogsApiQueueDungeonRunImportResult,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

export type QueueFellowshipLogsDungeonRunImportError =
  | BackgroundJobQueueError
  | FellowshipLogsDungeonRunDAOError
  | FellowshipLogsDungeonRunImportAlreadyImportedError;

type DeleteImportedDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

export type FellowshipLogsShape = {
  readonly deleteImportedDungeonRun: (
    options: DeleteImportedDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly getDungeonRunMetadata: (
    options: FellowshipLogsApiDungeonRunReference,
  ) => E.Effect<
    FellowshipLogsApiDungeonRunMetadata,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly getImportedDungeonRuns: () => E.Effect<
    FellowshipLogsApiImportedDungeonRunList,
    DungeonRunRepositoryError
  >;

  readonly getLastKnownRateLimitData: () => E.Effect<
    FellowshipLogsApiLastKnownRateLimitData,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly getRateLimitData: () => E.Effect<
    FellowshipLogsApiLastKnownRateLimitData,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly queueDungeonRunImport: (
    options: FellowshipLogsApiQueueDungeonRunImportOptions,
  ) => E.Effect<
    FellowshipLogsApiQueueDungeonRunImportResult,
    QueueFellowshipLogsDungeonRunImportError
  >;
};

const makeFellowshipLogs = E.gen(function* () {
  const backgroundJobQueue = yield* BackgroundJobQueue;
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogsGateway = yield* FellowshipLogsGateway;

  const deleteImportedDungeonRun: FellowshipLogsShape["deleteImportedDungeonRun"] =
    (options) => {
      return dungeonRunRepository.delete(options);
    };

  const getDungeonRunMetadata: FellowshipLogsShape["getDungeonRunMetadata"] = (
    options,
  ) => {
    return fellowshipLogsGateway
      .getDungeonRunMetadata(options)
      .pipe(E.map(createFellowshipLogsDungeonRunMetadataApiResponse));
  };

  const getImportedDungeonRuns: FellowshipLogsShape["getImportedDungeonRuns"] =
    () => {
      return dungeonRunRepository.listFellowshipLogsDungeonRuns().pipe(
        E.map((rows) => {
          return rows.map(createFellowshipLogsImportedDungeonRunApiResponse);
        }),
      );
    };

  const getRateLimitData: FellowshipLogsShape["getRateLimitData"] = () => {
    return fellowshipLogsGateway
      .getRateLimitData({ force: true })
      .pipe(E.map(createFellowshipLogsRateLimitDataApiResponse));
  };

  const getLastKnownRateLimitData: FellowshipLogsShape["getLastKnownRateLimitData"] =
    () => {
      return fellowshipLogsGateway
        .getRateLimitData()
        .pipe(E.map(createFellowshipLogsRateLimitDataApiResponse));
    };

  const queueDungeonRunImport: FellowshipLogsShape["queueDungeonRunImport"] = (
    options,
  ) => {
    return E.gen(function* () {
      const existing = yield* dungeonRunRepository.getFellowshipLogsDungeonRun({
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

      const { job, wasAlreadyQueued } = yield* backgroundJobQueue.offer({
        _tag: "ImportFellowshipLogsDungeonRun",
        ...options,
      });

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
  };

  return {
    deleteImportedDungeonRun,
    getDungeonRunMetadata,
    getImportedDungeonRuns,
    getLastKnownRateLimitData,
    getRateLimitData,
    queueDungeonRunImport,
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
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogsGateway.layer),
  );
}
