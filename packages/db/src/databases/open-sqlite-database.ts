import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as EString from "effect/String";

const prepareDatabaseDirectory = E.fn("prepareDatabaseDirectory")(function* (
  filename: string,
) {
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

/**
 * Opens a SQLite database configured the same way as every other database
 * file in the app. The client is closed when the scope closes.
 */
export const openSqliteDatabase = E.fn("openSqliteDatabase")(function* (
  filename: string,
) {
  yield* prepareDatabaseDirectory(filename);

  // WAL is turned on below instead: switching to it writes the new file's
  // header, which would fix `auto_vacuum` at its default first.
  const client = yield* SqliteClient.make({
    disableWAL: true,
    filename,
    transformQueryNames: EString.camelToSnake,
    transformResultNames: EString.snakeToCamel,
  });

  // Only takes effect on a new database, before anything is written to it.
  // Deleted rows then free pages that `PRAGMA incremental_vacuum` can give
  // back to the file system.
  yield* client`PRAGMA auto_vacuum = INCREMENTAL`;
  yield* client`PRAGMA journal_mode = WAL`;
  yield* client`PRAGMA foreign_keys = ON`;

  return client;
});
