import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";
import { migrateMainDatabase } from "@frt/db/migrate-database.ts";

/**
 * The main database: settings, the catalog, configurations and dungeon runs.
 * It holds the user's data, so it's never wiped. Provided as the generic
 * `SqlClient`.
 */
export function makeMainDatabaseLayer(filename: string) {
  return Layer.effect(
    SqlClient.SqlClient,
    E.gen(function* () {
      const client = yield* openSqliteDatabase(filename);

      yield* migrateMainDatabase.pipe(
        E.provideService(SqlClient.SqlClient, client),
      );

      return client;
    }),
  ).pipe(
    Layer.provide([NodeFileSystem.layer, NodePath.layer, Reactivity.layer]),
  );
}
