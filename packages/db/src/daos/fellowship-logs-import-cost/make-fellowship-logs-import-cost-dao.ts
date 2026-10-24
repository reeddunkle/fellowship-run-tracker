import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsImportCostDAOShape } from "@frt/db/daos/fellowship-logs-import-cost/fellowship-logs-import-cost-dao.ts";
import { AnalyticsDatabase } from "@frt/db/databases/analytics-database.ts";
import { FellowshipLogsImportCostModel } from "@frt/db/models/fellowship-logs-import-cost-model.ts";
import { FellowshipLogsConnectionProfileSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const LatestProfileRowsSchema = Schema.Array(
  Schema.Struct({
    profile: Schema.NullOr(FellowshipLogsConnectionProfileSchema),
  }),
);

export const makeFellowshipLogsImportCostDAO = E.gen(function* () {
  const sql = yield* AnalyticsDatabase;

  const insert: FellowshipLogsImportCostDAOShape["insert"] = E.fn(
    "FellowshipLogsImportCostDAO.insert",
  )(function* (value) {
    yield* sql`
      INSERT INTO
        fellowship_logs_import_cost (
          job_id,
          report_code,
          fight_id,
          profile,
          point_policy_version,
          outcome,
          is_resumed,
          follows_profile_change,
          includes_lookup,
          api_request_count,
          unmeasured_request_count,
          cache_hit_count,
          application_points,
          user_points,
          total_points,
          started_at,
          completed_at
        )
      VALUES
        (
          ${value.jobId},
          ${value.reportCode},
          ${value.fightId},
          ${value.profile},
          ${value.pointPolicyVersion},
          ${value.outcome},
          ${value.isResumed ? 1 : 0},
          ${value.followsProfileChange ? 1 : 0},
          ${value.includesLookup ? 1 : 0},
          ${value.apiRequestCount},
          ${value.unmeasuredRequestCount},
          ${value.cacheHitCount},
          ${value.applicationPoints},
          ${value.userPoints},
          ${value.totalPoints},
          ${DateTime.toEpochMillis(value.startedAt)},
          ${DateTime.toEpochMillis(value.completedAt)}
        )
    `;
  });

  const getLatestProfileForJob: FellowshipLogsImportCostDAOShape["getLatestProfileForJob"] =
    E.fn("FellowshipLogsImportCostDAO.getLatestProfileForJob")(function* ({
      jobId,
    }) {
      const rows = yield* sql`
        SELECT
          profile
        FROM
          fellowship_logs_import_cost
        WHERE
          job_id = ${jobId}
        ORDER BY
          completed_at DESC,
          id DESC
        LIMIT
          1
      `.pipe(E.flatMap(Schema.decodeUnknownEffect(LatestProfileRowsSchema)));

      return Option.map(Option.fromUndefinedOr(rows[0]), (row) => {
        return row.profile;
      });
    });

  const listRecent: FellowshipLogsImportCostDAOShape["listRecent"] = E.fn(
    "FellowshipLogsImportCostDAO.listRecent",
  )(function* ({ limit, profile }) {
    const rows = yield* sql`
      SELECT
        id,
        job_id,
        report_code,
        fight_id,
        profile,
        point_policy_version,
        outcome,
        is_resumed,
        follows_profile_change,
        includes_lookup,
        api_request_count,
        unmeasured_request_count,
        cache_hit_count,
        application_points,
        user_points,
        total_points,
        started_at,
        completed_at
      FROM
        fellowship_logs_import_cost
      WHERE
        ${profile === undefined ? sql`1 = 1` : sql`profile = ${profile}`}
      ORDER BY
        completed_at DESC,
        id DESC
      LIMIT
        ${limit}
    `;

    return yield* Schema.decodeUnknownEffect(
      Schema.Array(FellowshipLogsImportCostModel),
    )(rows);
  });

  return {
    getLatestProfileForJob,
    insert,
    listRecent,
  } satisfies FellowshipLogsImportCostDAOShape;
});
