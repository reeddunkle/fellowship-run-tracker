import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/* [KEEP]
 * Version 1 of the analytics database. Until this version ships, edit it in
 * place. After that, this folder is frozen and schema changes go in a new
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
});
