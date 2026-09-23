import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type FellowshipLogsDungeonRunImportAlreadyImportedError,
  type FellowshipLogsDungeonRunImportDungeonLevelNotFoundError,
  type FellowshipLogsDungeonRunImportRunNotFinishedError,
  type FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type FellowshipLogsEventDecodeError,
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type DungeonRunId } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsDungeonRunImporter } from "./make-fellowship-logs-dungeon-run-importer-service.ts";

type FellowshipLogsDungeonRunReference = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type ImportFellowshipLogsDungeonRunOptions =
  FellowshipLogsDungeonRunReference & {
    readonly isOwnRun: boolean;
    /** Called as report pages are fetched, from 0 to 1. */
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
  | FellowshipLogsEventDecodeError
  | FellowshipLogsGraphQLResponseError
  | FellowshipLogsRequestError;

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

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogs.layer),
  );
}
