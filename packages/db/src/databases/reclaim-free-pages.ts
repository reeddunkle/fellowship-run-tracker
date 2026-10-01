import * as E from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";

export function reclaimFreePages(
  sql: SqlClient.SqlClient,
): E.Effect<void, SqlError.SqlError> {
  const countFreePages = sql<{
    readonly freelistCount: number;
  }>`PRAGMA freelist_count`.pipe(
    E.map(([row]) => {
      return row?.freelistCount ?? 0;
    }),
  );

  const freePagesWhileShrinking = (
    freePages: number,
  ): E.Effect<void, SqlError.SqlError> => {
    if (freePages === 0) {
      return E.void;
    }

    return sql`PRAGMA incremental_vacuum`.pipe(
      E.andThen(countFreePages),
      E.flatMap((remainingFreePages) => {
        return remainingFreePages < freePages
          ? freePagesWhileShrinking(remainingFreePages)
          : E.void;
      }),
    );
  };

  return countFreePages.pipe(E.flatMap(freePagesWhileShrinking));
}
