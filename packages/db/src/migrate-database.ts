import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";
import { type SqlError } from "effect/sql/SqlError";

import { DatabaseNewerThanAppError } from "@frt/db/errors/database-newer-than-app-error.ts";
import { createInitialAnalyticsSchema } from "@frt/db/migrations/analytics/0001-initial/index.ts";
import { createInitialMainSchema } from "@frt/db/migrations/main/0001-initial/index.ts";
import { createInitialStateSchema } from "@frt/db/migrations/state/0001-initial/index.ts";

type MigrateDatabase = E.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  DatabaseNewerThanAppError | Migrator.MigrationError | SqlError,
  SqlClient.SqlClient
>;

type MigrateDatabaseOptions = {
  readonly database: DatabaseNewerThanAppError["database"];
  readonly migrations: Record<
    string,
    E.Effect<void, unknown, SqlClient.SqlClient>
  >;
};

const LatestMigrationRowsSchema = Schema.Array(
  Schema.Struct({ latestMigrationId: Schema.NullOr(Schema.Finite) }),
);

const runMigrations = Migrator.make({});

const getLatestMigrationId = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql`
    SELECT
      MAX(migration_id) AS latest_migration_id
    FROM
      effect_sql_migrations
  `.pipe(
    E.flatMap(Schema.decodeUnknownEffect(LatestMigrationRowsSchema)),
    E.orDie,
  );

  return row?.latestMigrationId ?? 0;
});

function migrateDatabase({
  database,
  migrations,
}: MigrateDatabaseOptions): MigrateDatabase {
  const loader = Migrator.fromRecord(migrations);

  return E.gen(function* () {
    const completedMigrations = yield* runMigrations({ loader });

    const supportedDatabaseVersion = yield* loader.pipe(
      E.map((resolvedMigrations) => {
        return A.reduce(resolvedMigrations, 0, (latestId, [id]) => {
          return Math.max(latestId, id);
        });
      }),
    );

    const databaseVersion = yield* getLatestMigrationId;

    if (databaseVersion > supportedDatabaseVersion) {
      return yield* new DatabaseNewerThanAppError({
        database,
        databaseVersion,
        supportedDatabaseVersion,
      });
    }

    return completedMigrations;
  });
}

export const migrateMainDatabase: MigrateDatabase = migrateDatabase({
  database: "Main",
  migrations: {
    "1_initial": createInitialMainSchema,
  },
});

export const migrateStateDatabase: MigrateDatabase = migrateDatabase({
  database: "State",
  migrations: {
    "1_initial": createInitialStateSchema,
  },
});

export const migrateAnalyticsDatabase: MigrateDatabase = migrateDatabase({
  database: "Analytics",
  migrations: {
    "1_initial": createInitialAnalyticsSchema,
  },
});
