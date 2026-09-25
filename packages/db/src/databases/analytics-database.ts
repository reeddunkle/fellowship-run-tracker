import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";
import { migrateAnalyticsDatabase } from "@frt/db/migrate-database.ts";

export class AnalyticsDatabase extends Context.Service<
  AnalyticsDatabase,
  SqlClient.SqlClient
>()("@frt/db/databases/analytics-database/AnalyticsDatabase") {}

export function makeAnalyticsDatabaseLayer(filename: string) {
  return Layer.effect(
    AnalyticsDatabase,
    E.gen(function* () {
      const client = yield* openSqliteDatabase(filename, {
        synchronous: "NORMAL",
      });

      yield* migrateAnalyticsDatabase.pipe(
        E.provideService(SqlClient.SqlClient, client),
      );

      return client;
    }),
  ).pipe(
    Layer.provide([NodeFileSystem.layer, NodePath.layer, Reactivity.layer]),
  );
}
