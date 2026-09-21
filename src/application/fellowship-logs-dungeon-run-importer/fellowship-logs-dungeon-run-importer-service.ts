import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type FellowshipLogsDungeonRunImportDungeonLevelNotFoundError,
  type FellowshipLogsDungeonRunImportRunNotFinishedError,
  type FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type FellowshipLogsEventDecodeError,
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@/errors/fellowship-logs-error.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { FellowshipLogs } from "@/services/fellowship-logs/fellowship-logs-service.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsDungeonRunImporter } from "./make-fellowship-logs-dungeon-run-importer-service.ts";

export type FellowshipLogsDungeonRunReference = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

export type ImportFellowshipLogsDungeonRunOptions =
  FellowshipLogsDungeonRunReference & {
    readonly isOwnRun: boolean;
  };

export type ImportFellowshipLogsDungeonRunResult = {
  readonly dungeonRunId: DungeonRunId;
};

export type ImportFellowshipLogsDungeonRunError =
  | DungeonRunRepositoryError
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
  "fellowship-run-tracker/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service/FellowshipLogsDungeonRunImporter",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsDungeonRunImporter,
  );

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(DungeonRunRepository.layer),
      Layer.provide(FellowshipLogs.layerWith(options)),
    );
  };
}
