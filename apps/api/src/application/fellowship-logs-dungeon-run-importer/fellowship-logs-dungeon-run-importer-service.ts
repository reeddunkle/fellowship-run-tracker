import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type FellowshipLogsDungeonRunImportAlreadyImportedError,
  type FellowshipLogsDungeonRunImportDungeonLevelNotFoundError,
  type FellowshipLogsDungeonRunImportReportChangedError,
  type FellowshipLogsDungeonRunImportRunNotFinishedError,
  type FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type FellowshipLogsEventDecodeError,
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRateLimitExceededError,
  type FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryError,
} from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { type FellowshipLogsImportPageDAOError } from "@frt/db/errors/fellowship-logs-import-page-dao-error.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
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
    /**
     * The job running the import. Fetched pages are saved under it, so if
     * the import stops partway, running the job again carries on from where
     * it stopped instead of fetching every page again.
     */
    readonly backgroundJobId?: BackgroundJobId;
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
  | FellowshipLogsDungeonRunImportReportChangedError
  | FellowshipLogsDungeonRunImportRunNotFinishedError
  | FellowshipLogsDungeonRunImportRunNotFoundError
  | FellowshipLogsEventDecodeError
  | FellowshipLogsImportPageDAOError
  | FellowshipLogsGraphQLResponseError
  | FellowshipLogsRateLimitExceededError
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
    Layer.provide(FellowshipLogsImportPageDAO.layer),
  );
}
