import * as E from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export const createFellowshipLogsLookupWorkflowSchema = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE fellowship_logs_lookup_workflow (
      id TEXT PRIMARY KEY NOT NULL,
      connection_generation TEXT NOT NULL,
      report_code TEXT NOT NULL,
      fight_id INTEGER NOT NULL,
      api_request_count INTEGER NOT NULL CHECK (api_request_count >= 0),
      unmeasured_request_count INTEGER NOT NULL CHECK (
        unmeasured_request_count >= 0
        AND unmeasured_request_count <= api_request_count
      ),
      cache_hit_count INTEGER NOT NULL CHECK (cache_hit_count >= 0),
      estimated_points REAL NOT NULL CHECK (estimated_points >= 0),
      application_points REAL NOT NULL CHECK (application_points >= 0),
      user_points REAL NOT NULL CHECK (user_points >= 0),
      total_points REAL NOT NULL CHECK (total_points >= 0),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL CHECK (expires_at >= created_at),
      claimed_by_job_id TEXT,
      claimed_at INTEGER,
      CHECK (
        (claimed_by_job_id IS NULL) = (claimed_at IS NULL)
      ),
      CHECK (
        claimed_at IS NULL
        OR claimed_at >= created_at
      )
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_lookup_workflow_expiry_index ON fellowship_logs_lookup_workflow (expires_at)
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_lookup_workflow_claim_index ON fellowship_logs_lookup_workflow (claimed_at)
  `;
});
