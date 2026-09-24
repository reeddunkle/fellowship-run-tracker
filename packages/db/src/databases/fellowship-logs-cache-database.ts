import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

import { prepareFellowshipLogsCacheSchema } from "@frt/db/databases/fellowship-logs-cache-schema.ts";
import { openSqliteDatabase } from "@frt/db/databases/open-sqlite-database.ts";

export class FellowshipLogsCacheDatabase extends Context.Service<
  FellowshipLogsCacheDatabase,
  SqlClient.SqlClient
>()(
  "@frt/db/databases/fellowship-logs-cache-database/FellowshipLogsCacheDatabase",
) {}

export function makeFellowshipLogsCacheDatabaseLayer(filename: string) {
  return Layer.effect(
    FellowshipLogsCacheDatabase,
    E.gen(function* () {
      const client = yield* openSqliteDatabase(filename, {
        synchronous: "NORMAL",
      });

      yield* prepareFellowshipLogsCacheSchema(client);

      return client;
    }),
  ).pipe(
    Layer.provide([NodeFileSystem.layer, NodePath.layer, Reactivity.layer]),
  );
}
