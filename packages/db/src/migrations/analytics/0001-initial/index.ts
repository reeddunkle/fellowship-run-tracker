import * as E from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

/* [KEEP]
 * Version 1 of the analytics database is frozen. Schema changes go in a new
 * migration.
 */
export const createInitialAnalyticsSchema = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE fellowship_logs_request (
      id INTEGER PRIMARY KEY,
      occurred_at INTEGER NOT NULL,
      operation TEXT NOT NULL CHECK (
        operation IN (
          'DUNGEON_RUN_METADATA',
          'FIGHT',
          'REPORT_PAGE',
          'RATE_LIMIT_DATA'
        )
      ),
      source TEXT NOT NULL CHECK (source IN ('CACHE', 'API')),
      points_spent INTEGER CHECK (
        points_spent IS NULL
        OR (
          source = 'API'
          AND points_spent >= 0
        )
      )
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_request_operation_source_index ON fellowship_logs_request (operation, source)
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_request_occurred_at_index ON fellowship_logs_request (occurred_at)
  `;

  yield* sql`
    CREATE TABLE fellowship_logs_import_cost (
      id INTEGER PRIMARY KEY,
      job_id TEXT NOT NULL,
      report_code TEXT NOT NULL,
      fight_id INTEGER NOT NULL,
      profile TEXT CHECK (
        profile IS NULL
        OR profile IN (
          'FELLOWSHIP_RUN_TRACKER_USER',
          'OWN_CLIENT',
          'OWN_CLIENT_USER'
        )
      ),
      point_policy_version TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (
        outcome IN ('SUCCEEDED', 'FAILED', 'DEFERRED', 'CANCELLED')
      ),
      is_resumed INTEGER NOT NULL CHECK (is_resumed IN (0, 1)),
      includes_lookup INTEGER NOT NULL CHECK (includes_lookup IN (0, 1)),
      follows_profile_change INTEGER NOT NULL DEFAULT 0 CHECK (follows_profile_change IN (0, 1)),
      api_request_count INTEGER NOT NULL CHECK (api_request_count >= 0),
      unmeasured_request_count INTEGER NOT NULL CHECK (
        unmeasured_request_count >= 0
        AND unmeasured_request_count <= api_request_count
      ),
      cache_hit_count INTEGER NOT NULL CHECK (cache_hit_count >= 0),
      application_points REAL NOT NULL CHECK (application_points >= 0),
      user_points REAL NOT NULL CHECK (user_points >= 0),
      total_points REAL NOT NULL CHECK (total_points >= 0),
      started_at INTEGER NOT NULL,
      completed_at INTEGER NOT NULL CHECK (completed_at >= started_at)
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_import_cost_job_id_index ON fellowship_logs_import_cost (job_id)
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_import_cost_completed_at_index ON fellowship_logs_import_cost (completed_at)
  `;
});
