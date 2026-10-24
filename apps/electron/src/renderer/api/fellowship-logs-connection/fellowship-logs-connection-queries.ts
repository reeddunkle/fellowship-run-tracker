import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import * as E from "effect/Effect";

import {
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiConnectionStatus,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

import {
  invalidateFellowshipLogsImportCostEstimate,
  invalidateFellowshipLogsPointData,
} from "@/renderer/api/fellowship-logs/fellowship-logs-invalidation.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import { getConnectionStatus } from "./fellowship-logs-connection-client.ts";

const PENDING_AUTHORIZATION_POLL_MILLISECONDS = 1_000;

const CONNECTION_STATUS_QUERY_KEY = ["fellowship-logs", "connection"] as const;

function isSameConnection(
  previous: FellowshipLogsApiConnection | null,
  next: FellowshipLogsApiConnection | null,
) {
  if (previous === null || next === null) {
    return previous === next;
  }

  return (
    previous.clientId === next.clientId &&
    previous.connectedUserName === next.connectedUserName &&
    previous.pointPolicyVersion === next.pointPolicyVersion &&
    previous.profile === next.profile &&
    previous.spending === next.spending &&
    previous.status === next.status &&
    previous.storageProtection === next.storageProtection
  );
}

export function getFellowshipLogsConnectionStatusQueryOptions() {
  return queryOptions({
    queryFn: ({ client }) => {
      const previous = client.getQueryData<FellowshipLogsApiConnectionStatus>(
        CONNECTION_STATUS_QUERY_KEY,
      );

      return browserRuntime.runPromise(
        getConnectionStatus().pipe(
          E.tap((next) => {
            return previous === undefined ||
              isSameConnection(previous.connection, next.connection)
              ? E.void
              : E.all(
                  [
                    invalidateFellowshipLogsPointData(client),
                    invalidateFellowshipLogsImportCostEstimate(client),
                  ],
                  { discard: true },
                ).pipe(E.ignore, E.forkDetach);
          }),
        ),
      );
    },
    queryKey: CONNECTION_STATUS_QUERY_KEY,
    refetchInterval: (query) => {
      return query.state.data?.authorization.state === "PENDING"
        ? PENDING_AUTHORIZATION_POLL_MILLISECONDS
        : false;
    },
    staleTime: Infinity,
  });
}

export function useFellowshipLogsConnectionStatusSuspense(): FellowshipLogsApiConnectionStatus {
  const { data } = useSuspenseQuery(
    getFellowshipLogsConnectionStatusQueryOptions(),
  );

  return data;
}
