import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

export const FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION = 1;

const UserVersionRowsSchema = Schema.Array(
  Schema.Struct({ userVersion: Schema.Finite }),
);

const TableNameRowsSchema = Schema.Array(
  Schema.Struct({ name: Schema.String }),
);

const createTables = E.fn("FellowshipLogsCacheSchema.createTables")(function* (
  sql: SqlClient.SqlClient,
) {
  // [KEEP] A response from the Fellowship Logs API, keyed by the request that
  // produced it. `body` is the gzipped JSON of the response's `data`.
  yield* sql`
    CREATE TABLE fellowship_logs_response (
      request_key TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL CHECK (
        operation IN ('DUNGEON_RUN_METADATA', 'FIGHT', 'REPORT_PAGE')
      ),
      report_code TEXT NOT NULL,
      fight_id INTEGER CHECK (fight_id >= 1),
      report_revision INTEGER,
      body BLOB NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL
    ) STRICT
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_response_report_code_index ON fellowship_logs_response (report_code)
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_response_last_accessed_at_index ON fellowship_logs_response (last_accessed_at)
  `;

  yield* sql`
    CREATE INDEX fellowship_logs_response_expires_at_index ON fellowship_logs_response (expires_at)
    WHERE
      expires_at IS NOT NULL
  `;
});

const dropTables = E.fn("FellowshipLogsCacheSchema.dropTables")(function* (
  sql: SqlClient.SqlClient,
) {
  const tables = yield* sql`
    SELECT
      name
    FROM
      sqlite_master
    WHERE
      type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `.pipe(E.flatMap(Schema.decodeUnknownEffect(TableNameRowsSchema)), E.orDie);

  yield* E.forEach(
    tables,
    ({ name }) => {
      return sql`DROP TABLE ${sql(name)}`;
    },
    { discard: true },
  );
});

export const prepareFellowshipLogsCacheSchema = E.fn(
  "FellowshipLogsCacheSchema.prepare",
)(function* (sql: SqlClient.SqlClient) {
  const [row] = yield* sql`PRAGMA user_version`.pipe(
    E.flatMap(Schema.decodeUnknownEffect(UserVersionRowsSchema)),
    E.orDie,
  );

  const userVersion = row?.userVersion ?? 0;

  if (userVersion === FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION) {
    return;
  }

  if (userVersion !== 0) {
    yield* E.logInfo(
      "The Fellowship Logs cache is from another version; rebuilding it.",
      {
        expectedVersion: FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION,
        userVersion,
      },
    );
  }

  yield* sql.withTransaction(
    E.gen(function* () {
      yield* dropTables(sql);
      yield* createTables(sql);
      yield* sql`
        PRAGMA user_version = ${sql.literal(
          String(FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION),
        )}
      `;
    }),
  );
});
