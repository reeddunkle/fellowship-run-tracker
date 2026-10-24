import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/sql/SqlError";

import { makeFellowshipLogsImportCostDAO } from "@frt/db/daos/fellowship-logs-import-cost/make-fellowship-logs-import-cost-dao.ts";
import { type FellowshipLogsImportCostModel } from "@frt/db/models/fellowship-logs-import-cost-model.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsImportOutcome } from "@frt/shared/fellowship-logs/fellowship-logs-import-cost-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

type FellowshipLogsImportCostDAOError = Schema.SchemaError | SqlError.SqlError;

type FellowshipLogsImportCostDAOValue = {
  readonly apiRequestCount: number;
  readonly applicationPoints: number;
  readonly cacheHitCount: number;
  readonly completedAt: DateTime.Utc;
  readonly fightId: FellowshipLogsFightId;
  readonly followsProfileChange: boolean;
  readonly includesLookup: boolean;
  readonly isResumed: boolean;
  readonly jobId: BackgroundJobId;
  readonly outcome: FellowshipLogsImportOutcome;
  readonly pointPolicyVersion: string;
  readonly profile: FellowshipLogsConnectionProfile | null;
  readonly reportCode: FellowshipLogsReportCode;
  readonly startedAt: DateTime.Utc;
  readonly totalPoints: number;
  readonly unmeasuredRequestCount: number;
  readonly userPoints: number;
};

export type FellowshipLogsImportCostDAOShape = {
  readonly getLatestProfileForJob: (options: {
    readonly jobId: BackgroundJobId;
  }) => E.Effect<
    Option.Option<FellowshipLogsConnectionProfile | null>,
    FellowshipLogsImportCostDAOError
  >;
  readonly insert: (
    value: FellowshipLogsImportCostDAOValue,
  ) => E.Effect<void, FellowshipLogsImportCostDAOError>;
  readonly listRecent: (options: {
    readonly limit: number;
    readonly profile?: FellowshipLogsConnectionProfile;
  }) => E.Effect<
    ReadonlyArray<FellowshipLogsImportCostModel>,
    FellowshipLogsImportCostDAOError
  >;
};

export class FellowshipLogsImportCostDAO extends Context.Service<
  FellowshipLogsImportCostDAO,
  FellowshipLogsImportCostDAOShape
>()(
  "@frt/db/daos/fellowship-logs-import-cost/fellowship-logs-import-cost-dao/FellowshipLogsImportCostDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsImportCostDAO);
}
