import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import * as Schema from "effect/Schema";

import {
  type FellowshipLogsApiCompleteAuthorizationOptions,
  type FellowshipLogsApiSaveOwnClientOptions,
  type FellowshipLogsApiStartAuthorizationOptions,
  type FellowshipLogsApiStartedAuthorization,
  FellowshipLogsApiStartedAuthorizationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

import {
  cancelAuthorization,
  checkPointSystemOptIn,
  completeAuthorization,
  disconnect,
  saveOwnClient,
  startAuthorization,
} from "./fellowship-logs-connection-client.ts";
import { invalidateFellowshipLogsConnectionStatus } from "./fellowship-logs-connection-invalidation.ts";

const START_AUTHORIZATION_MUTATION_NAME = "start-authorization";

const STARTED_AUTHORIZATION_GC_TIME_MILLISECONDS = 10 * 60_000;

const isStartedAuthorization = Schema.is(
  FellowshipLogsApiStartedAuthorizationSchema,
);

function getConnectionMutationKey(name: string) {
  return ["fellowship-logs", "connection", name] as const;
}

function connectionMutationOptions<Variables, Result>(
  queryClient: QueryClient,
  name: string,
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  return mutationOptions({
    mutationFn,
    mutationKey: getConnectionMutationKey(name),
    onSettled: () => {
      return browserRuntime.runPromise(
        invalidateFellowshipLogsConnectionStatus(queryClient),
      );
    },
  });
}

export function useStartFellowshipLogsAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    ...connectionMutationOptions(
      queryClient,
      START_AUTHORIZATION_MUTATION_NAME,
      (options: FellowshipLogsApiStartAuthorizationOptions) => {
        return browserRuntime.runPromise(startAuthorization(options));
      },
    ),
    gcTime: STARTED_AUTHORIZATION_GC_TIME_MILLISECONDS,
  });
}

export function useLatestStartedFellowshipLogsAuthorization(): FellowshipLogsApiStartedAuthorization | null {
  const started = useMutationState({
    filters: {
      mutationKey: getConnectionMutationKey(START_AUTHORIZATION_MUTATION_NAME),
      status: "success",
    },
    select: (mutation) => mutation.state.data,
  });

  return started.filter(isStartedAuthorization).at(-1) ?? null;
}

export function useCompleteFellowshipLogsAuthorization() {
  const queryClient = useQueryClient();

  return useMutation(
    connectionMutationOptions(
      queryClient,
      "complete-authorization",
      (options: FellowshipLogsApiCompleteAuthorizationOptions) => {
        return browserRuntime.runPromise(completeAuthorization(options));
      },
    ),
  );
}

export function useCancelFellowshipLogsAuthorization() {
  const queryClient = useQueryClient();

  return useMutation(
    connectionMutationOptions(queryClient, "cancel-authorization", () => {
      return browserRuntime.runPromise(cancelAuthorization());
    }),
  );
}

export function useSaveFellowshipLogsOwnClient() {
  const queryClient = useQueryClient();

  return useMutation(
    connectionMutationOptions(
      queryClient,
      "save-own-client",
      (options: FellowshipLogsApiSaveOwnClientOptions) => {
        return browserRuntime.runPromise(saveOwnClient(options));
      },
    ),
  );
}

export function useDisconnectFellowshipLogs() {
  const queryClient = useQueryClient();

  return useMutation(
    connectionMutationOptions(queryClient, "disconnect", () => {
      return browserRuntime.runPromise(disconnect());
    }),
  );
}

export function useCheckFellowshipLogsPointSystemOptIn() {
  const queryClient = useQueryClient();

  return useMutation(
    connectionMutationOptions(queryClient, "check-point-system-opt-in", () => {
      return browserRuntime.runPromise(checkPointSystemOptIn());
    }),
  );
}
