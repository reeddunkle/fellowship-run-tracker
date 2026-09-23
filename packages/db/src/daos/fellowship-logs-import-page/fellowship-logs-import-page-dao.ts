import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { makeFellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/make-fellowship-logs-import-page-dao.ts";
import { type FellowshipLogsImportPageDAOError } from "@frt/db/errors/fellowship-logs-import-page-dao-error.ts";
import { type FellowshipLogsImportPageModel } from "@frt/db/models/fellowship-logs-import-page-model.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

type BackgroundJobIdOptions = {
  readonly backgroundJobId: BackgroundJobId;
};

type InsertFellowshipLogsImportPageOptions = BackgroundJobIdOptions & {
  readonly nextPageTimestamp: number | null;
  readonly page: string;
  readonly pageIndex: number;
  readonly progress: number;
  readonly reportRevision: number;
};

export type FellowshipLogsImportPageDAOShape = {
  /** Removes every page saved for a job. */
  readonly deleteForJob: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, FellowshipLogsImportPageDAOError>;

  /**
   * Saves a fetched page. A page already saved at the same index is kept, so
   * saving it again is harmless.
   */
  readonly insert: (
    options: InsertFellowshipLogsImportPageOptions,
  ) => E.Effect<void, FellowshipLogsImportPageDAOError>;

  /** A job's saved pages, in the order they were fetched. */
  readonly list: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<
    ReadonlyArray<FellowshipLogsImportPageModel>,
    FellowshipLogsImportPageDAOError
  >;
};

export class FellowshipLogsImportPageDAO extends Context.Service<
  FellowshipLogsImportPageDAO,
  FellowshipLogsImportPageDAOShape
>()(
  "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao/FellowshipLogsImportPageDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsImportPageDAO);
}
