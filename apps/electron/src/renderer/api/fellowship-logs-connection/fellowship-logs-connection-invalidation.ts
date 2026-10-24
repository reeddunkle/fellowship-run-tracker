import { type QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";

import { QueryClientOperationError } from "@/errors/query-client-operation-error.ts";

import { getFellowshipLogsConnectionStatusQueryOptions } from "./fellowship-logs-connection-queries.ts";

export function invalidateFellowshipLogsConnectionStatus(
  queryClient: QueryClient,
): E.Effect<void, QueryClientOperationError> {
  return E.tryPromise({
    catch: (cause) => {
      return new QueryClientOperationError({
        cause,
        operation: "InvalidateQueries",
      });
    },
    try: () => {
      return queryClient.invalidateQueries({
        queryKey: getFellowshipLogsConnectionStatusQueryOptions().queryKey,
      });
    },
  });
}
