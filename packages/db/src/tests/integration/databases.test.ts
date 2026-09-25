import * as NodeServices from "@effect/platform-node/NodeServices";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, test } from "vitest";

import {
  AnalyticsDatabase,
  makeAnalyticsDatabaseLayer,
} from "@frt/db/databases/analytics-database.ts";
import {
  FellowshipLogsCacheDatabase,
  makeFellowshipLogsCacheDatabaseLayer,
} from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION } from "@frt/db/databases/fellowship-logs-cache-schema.ts";
import {
  MainDatabase,
  makeMainDatabaseLayer,
} from "@frt/db/databases/main-database.ts";
import {
  makeStateDatabaseLayer,
  StateDatabase,
} from "@frt/db/databases/state-database.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

function listTables(sql: SqlClient.SqlClient) {
  return sql<{ readonly name: string }>`
    SELECT
      name
    FROM
      sqlite_master
    WHERE
      type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'effect_sql_migrations'
    ORDER BY
      name
  `;
}

function getPragma(sql: SqlClient.SqlClient, pragma: string) {
  return sql<Record<string, number | string>>`
    PRAGMA ${sql.literal(pragma)}
  `.pipe(
    E.map((rows) => {
      return Object.values(rows[0] ?? {})[0];
    }),
  );
}

const withTempDirectory = <A, Error, Requirements>(
  program: (directory: string) => E.Effect<A, Error, Requirements>,
) => {
  return E.scoped(
    E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "fellowship-run-tracker-",
      });

      return yield* program(directory);
    }),
  ).pipe(E.provide(NodeServices.layer));
};

describe("Databases", () => {
  test("the main database holds settings, the catalog, configurations and runs", async () => {
    const program = E.gen(function* () {
      const sql = yield* MainDatabase;

      expect(yield* listTables(sql)).toEqual([
        { name: "ability" },
        { name: "ability_unit" },
        { name: "app_setting" },
        { name: "catalog_sync" },
        { name: "configuration" },
        { name: "configuration_definition" },
        { name: "dungeon" },
        { name: "dungeon_run" },
        { name: "dungeon_run_observation" },
        { name: "dungeon_unit" },
        { name: "encounter" },
        { name: "fellowship_logs_credential" },
        { name: "fellowship_logs_dungeon_run" },
        { name: "live_split_setting" },
        { name: "local_log_dungeon_run" },
        { name: "milestone" },
        { name: "milestone_requirement" },
        { name: "requirement" },
        { name: "unit" },
      ]);
    }).pipe(E.provide(makeMainDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("the state database holds the background job queue", async () => {
    const program = E.gen(function* () {
      const sql = yield* StateDatabase;

      expect(yield* listTables(sql)).toEqual([{ name: "background_job" }]);
    }).pipe(E.provide(makeStateDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("the analytics database holds Fellowship Logs requests", async () => {
    const program = E.gen(function* () {
      const sql = yield* AnalyticsDatabase;

      expect(yield* listTables(sql)).toEqual([
        { name: "fellowship_logs_request" },
      ]);
    }).pipe(E.provide(makeAnalyticsDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("the Fellowship Logs cache database holds responses, at the current schema version", async () => {
    const program = E.gen(function* () {
      const sql = yield* FellowshipLogsCacheDatabase;

      expect(yield* listTables(sql)).toEqual([
        { name: "fellowship_logs_response" },
      ]);

      expect(yield* getPragma(sql, "user_version")).toBe(
        FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION,
      );
    }).pipe(E.provide(makeFellowshipLogsCacheDatabaseLayer(":memory:")));

    await runTest(program);
  });

  test("opens each database with incremental auto-vacuum, WAL, its synchronous mode and foreign keys on", async () => {
    const program = withTempDirectory((directory) => {
      return E.gen(function* () {
        const path = yield* Path.Path;

        const main = yield* E.gen(function* () {
          const sql = yield* MainDatabase;

          return [
            yield* getPragma(sql, "auto_vacuum"),
            yield* getPragma(sql, "journal_mode"),
            yield* getPragma(sql, "synchronous"),
            yield* getPragma(sql, "foreign_keys"),
          ];
        }).pipe(
          E.provide(makeMainDatabaseLayer(path.join(directory, "main.db"))),
        );

        const state = yield* E.gen(function* () {
          const sql = yield* StateDatabase;

          return [
            yield* getPragma(sql, "auto_vacuum"),
            yield* getPragma(sql, "journal_mode"),
            yield* getPragma(sql, "synchronous"),
            yield* getPragma(sql, "foreign_keys"),
          ];
        }).pipe(
          E.provide(makeStateDatabaseLayer(path.join(directory, "state.db"))),
        );

        const cache = yield* E.gen(function* () {
          const sql = yield* FellowshipLogsCacheDatabase;

          return [
            yield* getPragma(sql, "auto_vacuum"),
            yield* getPragma(sql, "journal_mode"),
            yield* getPragma(sql, "synchronous"),
            yield* getPragma(sql, "foreign_keys"),
          ];
        }).pipe(
          E.provide(
            makeFellowshipLogsCacheDatabaseLayer(
              path.join(directory, "cache.db"),
            ),
          ),
        );

        // An `auto_vacuum` of 2 is INCREMENTAL.
        expect({ cache, main, state }).toEqual({
          cache: [2, "wal", 1, 1],
          main: [2, "wal", 2, 1],
          state: [2, "wal", 1, 1],
        });
      });
    });

    await runTest(program);
  });

  test("rebuilds a Fellowship Logs cache left by another schema version", async () => {
    const program = withTempDirectory((directory) => {
      return E.gen(function* () {
        const path = yield* Path.Path;
        const filename = path.join(directory, "cache.db");

        yield* E.gen(function* () {
          const sql = yield* FellowshipLogsCacheDatabase;

          yield* sql`
            INSERT INTO
              fellowship_logs_response (
                request_key,
                operation,
                report_code,
                body,
                byte_size,
                created_at,
                last_accessed_at
              )
            VALUES
              ('key', 'FIGHT', 'report', X'00', 1, 1000, 1000)
          `;

          yield* sql`PRAGMA user_version = 999`;
          yield* sql`CREATE TABLE left_behind (id INTEGER)`;
        }).pipe(E.provide(makeFellowshipLogsCacheDatabaseLayer(filename)));

        const reopened = yield* E.gen(function* () {
          const sql = yield* FellowshipLogsCacheDatabase;

          return {
            responses: yield* sql`
              SELECT
                request_key
              FROM
                fellowship_logs_response
            `,
            tables: yield* listTables(sql),
            userVersion: yield* getPragma(sql, "user_version"),
          };
        }).pipe(E.provide(makeFellowshipLogsCacheDatabaseLayer(filename)));

        expect(reopened).toEqual({
          responses: [],
          tables: [{ name: "fellowship_logs_response" }],
          userVersion: FELLOWSHIP_LOGS_CACHE_SCHEMA_VERSION,
        });
      });
    });

    await runTest(program);
  });

  test("creates the database parent directory on first startup", async () => {
    const program = withTempDirectory((directory) => {
      return E.gen(function* () {
        const path = yield* Path.Path;

        const databaseFilename = path.join(
          directory,
          "nested",
          "data",
          "fellowship-run-tracker.db",
        );

        yield* E.gen(function* () {
          const sql = yield* MainDatabase;

          expect((yield* listTables(sql)).length).toBeGreaterThan(0);
        }).pipe(E.provide(makeMainDatabaseLayer(databaseFilename)));
      });
    });

    await runTest(program);
  });
});
