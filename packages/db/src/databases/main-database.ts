import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";
import { migrateMainDatabase } from "@frt/db/migrate-database.ts";

export class MainDatabase extends Context.Service<
  MainDatabase,
  SqlClient.SqlClient
>()("@frt/db/databases/main-database/MainDatabase") {}

export function makeMainDatabaseLayer(filename: string) {
  return Layer.effect(
    MainDatabase,
    E.gen(function* () {
      const client = yield* openSqliteDatabase(filename, {
        synchronous: "FULL",
      });

      yield* migrateMainDatabase.pipe(
        E.provideService(SqlClient.SqlClient, client),
      );

      return client;
    }),
  ).pipe(
    Layer.provide([NodeFileSystem.layer, NodePath.layer, Reactivity.layer]),
  );
}
