import * as E from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/*
 * Version 1 of the state database. Until this version ships, edit it in
 * place. After that, this folder is frozen and schema changes go in a new
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
      available_at INTEGER CHECK ((status = 'WAITING') = (available_at IS NOT NULL)),
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
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
