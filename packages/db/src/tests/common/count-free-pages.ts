import * as E from "effect/Effect";
import * as Option from "effect/Option";
import type * as SqlClient from "effect/sql/SqlClient";

export function countFreePages(sql: SqlClient.SqlClient) {
  return sql<{ readonly freelistCount: number }>`PRAGMA freelist_count`.pipe(
    E.map(([row]) => {
      return Option.getOrThrow(Option.fromUndefinedOr(row)).freelistCount;
    }),
  );
}
