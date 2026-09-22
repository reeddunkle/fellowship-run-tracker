import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  FellowshipLogsDungeonRunImporter,
  type ImportFellowshipLogsDungeonRunError,
} from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import {
  createFellowshipLogsDungeonRunMetadataApiResponse,
  createFellowshipLogsImportDungeonRunApiResponse,
  createFellowshipLogsImportedDungeonRunApiResponse,
  createFellowshipLogsRateLimitDataApiResponse,
} from "@frt/api/services/api/fellowship-logs/create-fellowship-logs-api-response.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  FellowshipLogs,
  type FellowshipLogsRequestOperationError,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiImportDungeonRunOptions,
  type FellowshipLogsApiImportDungeonRunResult,
  type FellowshipLogsApiImportedDungeonRunList,
  type FellowshipLogsApiLastKnownRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

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

  readonly importDungeonRun: (
    options: FellowshipLogsApiImportDungeonRunOptions,
  ) => E.Effect<
    FellowshipLogsApiImportDungeonRunResult,
    ImportFellowshipLogsDungeonRunError
  >;
};

const makeFellowshipLogsApiService = E.gen(function* () {
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogs = yield* FellowshipLogs;
  const fellowshipLogsDungeonRunImporter =
    yield* FellowshipLogsDungeonRunImporter;

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

  const importDungeonRun: FellowshipLogsApiServiceShape["importDungeonRun"] = (
    options,
  ) => {
    return fellowshipLogsDungeonRunImporter
      .importReport(options)
      .pipe(E.map(createFellowshipLogsImportDungeonRunApiResponse));
  };

  return {
    deleteImportedDungeonRun,
    getDungeonRunMetadata,
    getImportedDungeonRuns,
    getLastKnownRateLimitData,
    getRateLimitData,
    importDungeonRun,
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

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(DungeonRunRepository.layer),
      Layer.provide(FellowshipLogs.layerWith(options)),
      Layer.provide(FellowshipLogsDungeonRunImporter.layerWith(options)),
    );
  };
}
