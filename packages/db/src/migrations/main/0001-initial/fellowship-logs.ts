import * as E from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export const createFellowshipLogsTables = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE fellowship_logs_connection (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      profile TEXT NOT NULL CHECK (
        profile IN (
          'FELLOWSHIP_RUN_TRACKER_USER',
          'OWN_CLIENT',
          'OWN_CLIENT_USER'
        )
      ),
      client_id TEXT NOT NULL,
      client_secret TEXT,
      access_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token TEXT,
      connected_user_id TEXT,
      connected_user_name TEXT,
      generation TEXT NOT NULL,
      point_policy_version TEXT NOT NULL CHECK (point_policy_version = '2026-10-20-beta'),
      storage_protection TEXT NOT NULL CHECK (storage_protection IN ('OS_BACKED', 'LOCAL_KEY')),
      local_protection_acknowledged_at INTEGER,
      point_system_opt_in_required_at INTEGER CHECK (
        point_system_opt_in_required_at IS NULL
        OR profile = 'FELLOWSHIP_RUN_TRACKER_USER'
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        (
          profile = 'OWN_CLIENT'
          AND client_secret IS NOT NULL
          AND access_token IS NULL
          AND access_token_expires_at IS NULL
          AND refresh_token IS NULL
        )
        OR (
          profile IN ('FELLOWSHIP_RUN_TRACKER_USER', 'OWN_CLIENT_USER')
          AND client_secret IS NULL
          AND (
            (
              access_token IS NULL
              AND access_token_expires_at IS NULL
              AND refresh_token IS NULL
            )
            OR (
              access_token IS NOT NULL
              AND access_token_expires_at IS NOT NULL
            )
          )
        )
      ),
      CHECK (
        (
          storage_protection = 'OS_BACKED'
          AND local_protection_acknowledged_at IS NULL
        )
        OR (
          storage_protection = 'LOCAL_KEY'
          AND local_protection_acknowledged_at IS NOT NULL
        )
      )
    ) STRICT
  `;

  yield* sql`
    CREATE TABLE fellowship_logs_authorization_transaction (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      profile TEXT NOT NULL CHECK (
        profile IN ('FELLOWSHIP_RUN_TRACKER_USER', 'OWN_CLIENT_USER')
      ),
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      state TEXT NOT NULL,
      protected_verifier TEXT NOT NULL,
      expected_generation TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
    ) STRICT
  `;
});
