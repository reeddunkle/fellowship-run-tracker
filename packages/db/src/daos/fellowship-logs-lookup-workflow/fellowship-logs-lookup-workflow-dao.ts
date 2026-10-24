import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/sql/SqlError";

import { makeFellowshipLogsLookupWorkflowDAO } from "@frt/db/daos/fellowship-logs-lookup-workflow/make-fellowship-logs-lookup-workflow-dao.ts";
import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type FellowshipLogsConnectionGeneration } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsLookupWorkflowId } from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export type FellowshipLogsLookupWorkflowCost = {
  readonly apiRequestCount: number;
  readonly applicationPoints: number;
  readonly cacheHitCount: number;
  readonly estimatedPoints: number;
  readonly totalPoints: number;
  readonly unmeasuredRequestCount: number;
  readonly userPoints: number;
};

type FellowshipLogsLookupWorkflowDAOError =
  | Schema.SchemaError
  | SqlError.SqlError;

export type ClaimFellowshipLogsLookupWorkflowResult =
  | {
      readonly cost: FellowshipLogsLookupWorkflowCost;
      readonly status: "CLAIMED";
    }
  | {
      readonly reason: "ALREADY_CLAIMED" | "EXPIRED" | "MISMATCHED" | "MISSING";
      readonly status: "UNAVAILABLE";
    };

type FellowshipLogsLookupWorkflowReference = {
  readonly connectionGeneration: FellowshipLogsConnectionGeneration;
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
  readonly workflowId: FellowshipLogsLookupWorkflowId;
};

export type FellowshipLogsLookupWorkflowDAOShape = {
  readonly claim: (
    options: FellowshipLogsLookupWorkflowReference & {
      readonly claimedAt: DateTime.Utc;
      readonly claimedRetentionBefore: DateTime.Utc;
      readonly jobId: BackgroundJobId;
    },
  ) => E.Effect<
    ClaimFellowshipLogsLookupWorkflowResult,
    FellowshipLogsLookupWorkflowDAOError
  >;
  readonly deleteClaimed: (options: {
    readonly jobId: BackgroundJobId;
    readonly workflowId: FellowshipLogsLookupWorkflowId;
  }) => E.Effect<void, FellowshipLogsLookupWorkflowDAOError>;
  readonly insert: (
    value: FellowshipLogsLookupWorkflowReference &
      FellowshipLogsLookupWorkflowCost & {
        readonly createdAt: DateTime.Utc;
        readonly expiresAt: DateTime.Utc;
      },
  ) => E.Effect<void, FellowshipLogsLookupWorkflowDAOError>;
  readonly prune: (options: {
    readonly claimedRetentionBefore: DateTime.Utc;
    readonly now: DateTime.Utc;
  }) => E.Effect<number, FellowshipLogsLookupWorkflowDAOError>;
};

export class FellowshipLogsLookupWorkflowDAO extends Context.Service<
  FellowshipLogsLookupWorkflowDAO,
  FellowshipLogsLookupWorkflowDAOShape
>()(
  "@frt/db/daos/fellowship-logs-lookup-workflow/fellowship-logs-lookup-workflow-dao/FellowshipLogsLookupWorkflowDAO",
) {
  static readonly layer = Layer.effect(
    this,
    makeFellowshipLogsLookupWorkflowDAO,
  );
}
