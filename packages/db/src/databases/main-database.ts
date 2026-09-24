import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";
import { migrateMainDatabase } from "@frt/db/migrate-database.ts";

// [TODO] Review; currently provided as the generic `SqlClient`.
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
