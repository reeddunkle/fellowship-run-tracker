import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  type ClaimFellowshipLogsLookupWorkflowResult,
  type FellowshipLogsLookupWorkflowCost,
  type FellowshipLogsLookupWorkflowDAOShape,
} from "@frt/db/daos/fellowship-logs-lookup-workflow/fellowship-logs-lookup-workflow-dao.ts";
import { AnalyticsDatabase } from "@frt/db/databases/analytics-database.ts";
import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";
import { FellowshipLogsConnectionGenerationSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsLookupWorkflowIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-lookup-workflow-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  NonNegativeIntegerSchema,
  NonNegativeNumberSchema,
} from "@frt/shared/util/common-schemas.ts";

const LookupWorkflowRowSchema = Schema.Struct({
  apiRequestCount: NonNegativeIntegerSchema,
  applicationPoints: NonNegativeNumberSchema,
  cacheHitCount: NonNegativeIntegerSchema,
  claimedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  claimedByJobId: Schema.NullOr(BackgroundJobIdSchema),
  connectionGeneration: FellowshipLogsConnectionGenerationSchema,
  estimatedPoints: NonNegativeNumberSchema,
  expiresAt: Schema.DateTimeUtcFromMillis,
  fightId: FellowshipLogsFightIdSchema,
  id: FellowshipLogsLookupWorkflowIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
  totalPoints: NonNegativeNumberSchema,
  unmeasuredRequestCount: NonNegativeIntegerSchema,
  userPoints: NonNegativeNumberSchema,
});

const LookupWorkflowRowsSchema = Schema.Array(LookupWorkflowRowSchema);

function getCost(
  row: typeof LookupWorkflowRowSchema.Type,
): FellowshipLogsLookupWorkflowCost {
  return {
    apiRequestCount: row.apiRequestCount,
    applicationPoints: row.applicationPoints,
    cacheHitCount: row.cacheHitCount,
    estimatedPoints: row.estimatedPoints,
    totalPoints: row.totalPoints,
    unmeasuredRequestCount: row.unmeasuredRequestCount,
    userPoints: row.userPoints,
  };
}

export const makeFellowshipLogsLookupWorkflowDAO = E.gen(function* () {
  const sql = yield* AnalyticsDatabase;

  const prune: FellowshipLogsLookupWorkflowDAOShape["prune"] = E.fn(
    "FellowshipLogsLookupWorkflowDAO.prune",
  )(function* ({ claimedRetentionBefore, now }) {
    const rows = yield* sql<{ readonly id: string }>`
      DELETE FROM fellowship_logs_lookup_workflow
      WHERE
        (
          claimed_at IS NULL
          AND expires_at <= ${DateTime.toEpochMillis(now)}
        )
        OR (
          claimed_at IS NOT NULL
          AND claimed_at <= ${DateTime.toEpochMillis(claimedRetentionBefore)}
        )
      RETURNING
        id
    `;

    return rows.length;
  });

  const insert: FellowshipLogsLookupWorkflowDAOShape["insert"] = E.fn(
    "FellowshipLogsLookupWorkflowDAO.insert",
  )(function* (value) {
    yield* sql`
      INSERT INTO
        fellowship_logs_lookup_workflow (
          id,
          connection_generation,
          report_code,
          fight_id,
          api_request_count,
          unmeasured_request_count,
          cache_hit_count,
          estimated_points,
          application_points,
          user_points,
          total_points,
          created_at,
          expires_at,
          claimed_by_job_id,
          claimed_at
        )
      VALUES
        (
          ${value.workflowId},
          ${value.connectionGeneration},
          ${value.reportCode},
          ${value.fightId},
          ${value.apiRequestCount},
          ${value.unmeasuredRequestCount},
          ${value.cacheHitCount},
          ${value.estimatedPoints},
          ${value.applicationPoints},
          ${value.userPoints},
          ${value.totalPoints},
          ${DateTime.toEpochMillis(value.createdAt)},
          ${DateTime.toEpochMillis(value.expiresAt)},
          NULL,
          NULL
        )
    `;
  });

  const claim: FellowshipLogsLookupWorkflowDAOShape["claim"] = E.fn(
    "FellowshipLogsLookupWorkflowDAO.claim",
  )(function* ({
    claimedAt,
    claimedRetentionBefore,
    connectionGeneration,
    fightId,
    jobId,
    reportCode,
    workflowId,
  }) {
    return yield* sql.withTransaction(
      E.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            connection_generation,
            report_code,
            fight_id,
            api_request_count,
            unmeasured_request_count,
            cache_hit_count,
            estimated_points,
            application_points,
            user_points,
            total_points,
            expires_at,
            claimed_by_job_id,
            claimed_at
          FROM
            fellowship_logs_lookup_workflow
          WHERE
            id = ${workflowId}
          LIMIT
            1
        `.pipe(E.flatMap(Schema.decodeUnknownEffect(LookupWorkflowRowsSchema)));
        const row = Option.fromUndefinedOr(rows[0]);

        const result: ClaimFellowshipLogsLookupWorkflowResult = Option.match(
          row,
          {
            onNone: () => ({ reason: "MISSING", status: "UNAVAILABLE" }),
            onSome: (value) => {
              if (
                value.connectionGeneration !== connectionGeneration ||
                value.reportCode !== reportCode ||
                value.fightId !== fightId
              ) {
                return { reason: "MISMATCHED", status: "UNAVAILABLE" };
              }

              if (
                DateTime.toEpochMillis(value.expiresAt) <=
                  DateTime.toEpochMillis(claimedAt) &&
                value.claimedByJobId === null
              ) {
                return { reason: "EXPIRED", status: "UNAVAILABLE" };
              }

              if (
                value.claimedByJobId !== null &&
                value.claimedByJobId !== jobId
              ) {
                return {
                  reason: "ALREADY_CLAIMED",
                  status: "UNAVAILABLE",
                };
              }

              return { cost: getCost(value), status: "CLAIMED" };
            },
          },
        );

        if (
          result.status === "CLAIMED" &&
          Option.isSome(row) &&
          row.value.claimedByJobId === null
        ) {
          yield* sql`
            UPDATE fellowship_logs_lookup_workflow
            SET
              claimed_by_job_id = ${jobId},
              claimed_at = ${DateTime.toEpochMillis(claimedAt)}
            WHERE
              id = ${workflowId}
              AND claimed_by_job_id IS NULL
          `;
        }

        yield* prune({ claimedRetentionBefore, now: claimedAt });

        return result;
      }),
    );
  });

  const deleteClaimed: FellowshipLogsLookupWorkflowDAOShape["deleteClaimed"] =
    E.fn("FellowshipLogsLookupWorkflowDAO.deleteClaimed")(function* ({
      jobId,
      workflowId,
    }) {
      yield* sql`
        DELETE FROM fellowship_logs_lookup_workflow
        WHERE
          id = ${workflowId}
          AND claimed_by_job_id = ${jobId}
      `;
    });

  return {
    claim,
    deleteClaimed,
    insert,
    prune,
  } satisfies FellowshipLogsLookupWorkflowDAOShape;
});
