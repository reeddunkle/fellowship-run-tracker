import * as E from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

/* [KEEP]
 * Version 1 of the state database is frozen. Schema changes go in a new
 * migration.
 */
export const createInitialStateSchema = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE background_job (
      id TEXT PRIMARY KEY NOT NULL,
      queue TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL CHECK (json_valid(payload)),
      status TEXT NOT NULL CHECK (
        status IN (
          'QUEUED',
          'WAITING',
          'RUNNING',
          'SUCCEEDED',
          'FAILED'
        )
      ),
      idempotency_key TEXT,
      waiting_kind TEXT CHECK (
        waiting_kind IS NULL
        OR waiting_kind IN ('CONDITION', 'HOLD', 'RESET')
      ),
      waiting_reason TEXT CHECK (
        waiting_reason IS NULL
        OR waiting_reason <> ''
      ),
      available_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      error TEXT CHECK (
        error IS NULL
        OR json_valid(error)
      ),
      result TEXT CHECK (
        result IS NULL
        OR json_valid(result)
      ),
      started_at INTEGER,
      finished_at INTEGER,
      traceparent TEXT,
      binding_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK ((status = 'WAITING') = (waiting_kind IS NOT NULL)),
      CHECK ((waiting_kind IS NULL) = (waiting_reason IS NULL)),
      CHECK (
        waiting_kind IS NULL
        OR (waiting_kind = 'RESET') = (available_at IS NOT NULL)
      ),
      CHECK (
        available_at IS NULL
        OR status = 'WAITING'
      )
    ) STRICT
  `;

  yield* sql`
    CREATE UNIQUE INDEX background_job_queue_idempotency_key_active_index ON background_job (queue, idempotency_key)
    WHERE
      idempotency_key IS NOT NULL
      AND status IN ('QUEUED', 'WAITING', 'RUNNING')
  `;

  yield* sql`
    CREATE INDEX background_job_queue_status_created_at_index ON background_job (queue, status, created_at)
  `;
});
