import { type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";

import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";
import { DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";

import {
  getFellowshipLogsDungeonRunsQueryOptions,
  getFellowshipLogsLastKnownRateLimitDataQueryOptions,
} from "./fellowship-logs-queries.ts";

function invalidateQueries(
  queryClient: QueryClient,
  queryKey: ReadonlyArray<unknown>,
): E.Effect<void, QueryClientOperationError> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "InvalidateQueries",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function invalidateImportedDungeonRuns(queryClient: QueryClient) {
  return invalidateQueries(
    queryClient,
    getFellowshipLogsDungeonRunsQueryOptions().queryKey,
  );
}

export function invalidateDungeonRunHistory(queryClient: QueryClient) {
  return invalidateQueries(queryClient, DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX);
}

export function invalidateFellowshipLogsRateLimitData(
  queryClient: QueryClient,
) {
  return invalidateQueries(
    queryClient,
    getFellowshipLogsLastKnownRateLimitDataQueryOptions().queryKey,
  );
}
