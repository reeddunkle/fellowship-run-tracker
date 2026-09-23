import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { BackgroundJobError } from "@frt/api/errors/background-job-error.ts";
import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { createImportFellowshipLogsDungeonRunBackgroundJobApiItem } from "@frt/api/services/api/background-job/create-background-job-api-response.ts";
import {
  createFellowshipLogsDungeonRunMetadataApiResponse,
  createFellowshipLogsImportedDungeonRunApiResponse,
  createFellowshipLogsRateLimitDataApiResponse,
} from "@frt/api/services/api/fellowship-logs/create-fellowship-logs-api-response.ts";
import { BackgroundJobService } from "@frt/api/services/background-job/background-job-service.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  FellowshipLogs,
  type FellowshipLogsRequestOperationError,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@frt/db/errors/fellowship-logs-dungeon-run-dao-error.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiLastKnownRateLimitData,
  type FellowshipLogsApiQueueDungeonRunImportOptions,
  type FellowshipLogsApiQueueDungeonRunImportResult,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

export type QueueFellowshipLogsDungeonRunImportError =
  | BackgroundJobError
  | FellowshipLogsDungeonRunDAOError
  | FellowshipLogsDungeonRunImportAlreadyImportedError;

type DeleteImportedDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

export type FellowshipLogsApiServiceShape = {
  readonly deleteImportedDungeonRun: (
    options: DeleteImportedDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly getDungeonRunMetadata: (
    options: FellowshipLogsApiDungeonRunReference,
  ) => E.Effect<
    FellowshipLogsApiDungeonRunMetadata,
    FellowshipLogsRequestOperationError
  >;

  readonly getImportedDungeonRuns: () => E.Effect<
    FellowshipLogsApiImportedDungeonRunList,
    DungeonRunRepositoryError
  >;

  readonly getLastKnownRateLimitData: () => E.Effect<
    FellowshipLogsApiLastKnownRateLimitData,
    FellowshipLogsRequestOperationError
  >;

  readonly getRateLimitData: () => E.Effect<
    FellowshipLogsApiLastKnownRateLimitData,
    FellowshipLogsRequestOperationError
  >;

  /**
   * Durably queues an import and returns as soon as it's committed. The import
   * itself runs later on the background job worker.
   */
  readonly queueDungeonRunImport: (
    options: FellowshipLogsApiQueueDungeonRunImportOptions,
  ) => E.Effect<
    FellowshipLogsApiQueueDungeonRunImportResult,
    QueueFellowshipLogsDungeonRunImportError
  >;
};

const makeFellowshipLogsApiService = E.gen(function* () {
  const backgroundJobService = yield* BackgroundJobService;
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogs = yield* FellowshipLogs;

  const deleteImportedDungeonRun: FellowshipLogsApiServiceShape["deleteImportedDungeonRun"] =
    (options) => {
      return dungeonRunRepository.delete(options);
    };

  const getDungeonRunMetadata: FellowshipLogsApiServiceShape["getDungeonRunMetadata"] =
    (options) => {
      return fellowshipLogs
        .getDungeonRunMetadata(options)
        .pipe(E.map(createFellowshipLogsDungeonRunMetadataApiResponse));
    };

  const getImportedDungeonRuns: FellowshipLogsApiServiceShape["getImportedDungeonRuns"] =
    () => {
      return dungeonRunRepository.listFellowshipLogsDungeonRuns().pipe(
        E.map((rows) => {
          return rows.map(createFellowshipLogsImportedDungeonRunApiResponse);
        }),
      );
    };

  const getRateLimitData: FellowshipLogsApiServiceShape["getRateLimitData"] =
    () => {
      return fellowshipLogs
        .getRateLimitData({ force: true })
        .pipe(E.map(createFellowshipLogsRateLimitDataApiResponse));
    };

  const getLastKnownRateLimitData: FellowshipLogsApiServiceShape["getLastKnownRateLimitData"] =
    () => {
      return fellowshipLogs
        .getRateLimitData()
        .pipe(E.map(createFellowshipLogsRateLimitDataApiResponse));
    };

  const queueDungeonRunImport: FellowshipLogsApiServiceShape["queueDungeonRunImport"] =
    (options) => {
      return E.gen(function* () {
        // Checked up front so the user hears about it now, not when the job
        // runs. The importer checks again in case it's imported meanwhile.
        const existing =
          yield* dungeonRunRepository.getFellowshipLogsDungeonRun({
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

        const { job, wasAlreadyQueued } = yield* backgroundJobService.offer({
          _tag: "ImportFellowshipLogsDungeonRun",
          ...options,
        });

        const item = createImportFellowshipLogsDungeonRunBackgroundJobApiItem({
          job,
          progress: null,
        });

        if (Option.isNone(item)) {
          return yield* new BackgroundJobError({
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
  } satisfies FellowshipLogsApiServiceShape;
});

export class FellowshipLogsApiService extends Context.Service<
  FellowshipLogsApiService,
  FellowshipLogsApiServiceShape
>()(
  "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service/FellowshipLogsApiService",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsApiService,
  );

  /**
   * Leaves `BackgroundJobService` for the application root to provide, since
   * it's the single instance that runs the queue workers.
   */
  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogs.layer),
  );
}
