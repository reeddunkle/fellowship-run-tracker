import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";
import { migrateStateDatabase } from "@frt/db/migrate-database.ts";

/**
 * The state database: the background job queue. Deleting it loses queued
 * and finished jobs but none of the user's data.
 */
export class StateDatabase extends Context.Service<
  StateDatabase,
  SqlClient.SqlClient
>()("@frt/db/databases/state-database/StateDatabase") {}

export function makeStateDatabaseLayer(filename: string) {
  return Layer.effect(
    StateDatabase,
    E.gen(function* () {
      const client = yield* openSqliteDatabase(filename);

      yield* migrateStateDatabase.pipe(
        E.provideService(SqlClient.SqlClient, client),
      );

      return client;
    }),
  ).pipe(
    Layer.provide([NodeFileSystem.layer, NodePath.layer, Reactivity.layer]),
  );
}
