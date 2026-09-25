import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { appConfig } from "@frt/api/app-config.ts";
import {
  type FellowshipLogsDungeonRunImportAlreadyImportedError,
  type FellowshipLogsDungeonRunImportDungeonLevelNotFoundError,
  type FellowshipLogsDungeonRunImportRunNotFinishedError,
  type FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type FellowshipLogsGatewayEventDecodeError,
  type FellowshipLogsGatewayGraphQLResponseError,
  type FellowshipLogsGatewayRateLimitExceededError,
  type FellowshipLogsGatewayReportChangedError,
  type FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsDungeonRunImporter } from "./make-fellowship-logs-dungeon-run-importer-service.ts";
import { makeSimulatedFellowshipLogsDungeonRunImporter } from "./make-simulated-fellowship-logs-dungeon-run-importer.ts";

type FellowshipLogsDungeonRunReference = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type ImportFellowshipLogsDungeonRunOptions =
  FellowshipLogsDungeonRunReference & {
    readonly isOwnRun: boolean;
    readonly onProgress?: (fraction: number) => E.Effect<void>;
  };

type ImportFellowshipLogsDungeonRunResult = {
  readonly dungeonRunId: DungeonRunId;
};

type ImportFellowshipLogsDungeonRunError =
  | DungeonRunRepositoryError
  | FellowshipLogsDungeonRunImportAlreadyImportedError
  | FellowshipLogsDungeonRunImportDungeonLevelNotFoundError
  | FellowshipLogsDungeonRunImportRunNotFinishedError
  | FellowshipLogsDungeonRunImportRunNotFoundError
  | FellowshipLogsGatewayEventDecodeError
  | FellowshipLogsGatewayGraphQLResponseError
  | FellowshipLogsGatewayRateLimitExceededError
  | FellowshipLogsGatewayReportChangedError
  | FellowshipLogsGatewayRequestError;

export type FellowshipLogsDungeonRunImporterServiceShape = {
  readonly importReport: (
    options: ImportFellowshipLogsDungeonRunOptions,
  ) => E.Effect<
    ImportFellowshipLogsDungeonRunResult,
    ImportFellowshipLogsDungeonRunError
  >;
};

export class FellowshipLogsDungeonRunImporter extends Context.Service<
  FellowshipLogsDungeonRunImporter,
  FellowshipLogsDungeonRunImporterServiceShape
>()(
  "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service/FellowshipLogsDungeonRunImporter",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsDungeonRunImporter,
  );

  static readonly liveLayer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogsGateway.layer),
  );

  static readonly simulatedLayer = Layer.effect(
    this,
    E.map(
      makeFellowshipLogsDungeonRunImporter,
      makeSimulatedFellowshipLogsDungeonRunImporter,
    ),
  ).pipe(
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogsGateway.layer),
  );

  static readonly layer = Layer.unwrap(
    E.gen(function* () {
      const simulateImports = yield* appConfig.fellowshipLogsSimulateImports;

      return simulateImports
        ? FellowshipLogsDungeonRunImporter.simulatedLayer
        : FellowshipLogsDungeonRunImporter.liveLayer;
    }),
  );
}
