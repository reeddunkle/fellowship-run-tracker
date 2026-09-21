import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as EString from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { migrateDatabase } from "@/db/migrate-database.ts";

function prepareDatabaseDirectory(filename: string) {
  return E.gen(function* () {
    if (filename === ":memory:") {
      return;
    }

    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directory = path.dirname(filename);

    if (directory === ".") {
      return;
    }

    yield* fileSystem.makeDirectory(directory, {
      recursive: true,
    });
  });
}

function configureDatabase() {
  return E.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    yield* sql`PRAGMA foreign_keys = ON`;
  });
}

export function makeDatabaseLayer(filename: string) {
  const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

  const SqliteLayer = SqliteClient.layer({
    filename,
    transformQueryNames: EString.camelToSnake,
    transformResultNames: EString.snakeToCamel,
  });

  const PrepareDatabaseLayer = Layer.effectDiscard(
    prepareDatabaseDirectory(filename),
  ).pipe(Layer.provide(PlatformLayer));

  const PreparedSqliteLayer = PrepareDatabaseLayer.pipe(
    Layer.flatMap(() => SqliteLayer),
  );

  const ConfiguredSqliteLayer = Layer.effectDiscard(configureDatabase()).pipe(
    Layer.provideMerge(PreparedSqliteLayer),
  );

  const MigrationDependenciesLayer = Layer.mergeAll(
    ConfiguredSqliteLayer,
    PlatformLayer,
  );

  return Layer.effectDiscard(migrateDatabase).pipe(
    Layer.provideMerge(MigrationDependenciesLayer),
  );
}
