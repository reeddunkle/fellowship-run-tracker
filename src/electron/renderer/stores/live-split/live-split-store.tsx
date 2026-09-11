import * as E from "effect/Effect";
import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { type ApiConnectionState } from "@/electron/renderer/api/common.ts";
import * as liveSplitClient from "@/electron/renderer/api/live-split/live-split-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { type LiveSplitApiStatus } from "@/services/api/live-split/live-split-api-schema.ts";

import { liveSplitEventStore } from "./live-split-event-store.ts";

type LiveSplitActionResult = {
  readonly error: unknown | undefined;
};

type LiveSplitContextValue = {
  readonly connectionState: ApiConnectionState;
  readonly connect: () => void;
  readonly connectError: unknown | undefined;
  readonly disconnect: () => void;
  readonly disconnectError: unknown | undefined;
  readonly isConnecting: boolean;
  readonly isDisconnecting: boolean;
  readonly liveSplitStatus: LiveSplitApiStatus | null;
};

type LiveSplitProviderProps = {
  readonly children: ReactNode;
};

export type LiveSplitActionState = {
  readonly connectError: unknown | undefined;
  readonly disconnectError: unknown | undefined;
  readonly isConnecting: boolean;
  readonly isDisconnecting: boolean;
  readonly isPending: boolean;
};

export type LiveSplitServerState = {
  readonly connectionState: ApiConnectionState;
  readonly liveSplitStatus: LiveSplitApiStatus | null;
};

const INITIAL_LIVE_SPLIT_ACTION_RESULT: LiveSplitActionResult = {
  error: undefined,
};

const LiveSplitContext = createContext<LiveSplitContextValue | undefined>(
  undefined,
);

export function LiveSplitProvider({ children }: LiveSplitProviderProps) {
  const liveSplitSnapshot = useSyncExternalStore(
    liveSplitEventStore.subscribe,
    liveSplitEventStore.getSnapshot,
  );

  const [connectState, dispatchConnect, isConnecting] = useActionState(
    (): Promise<LiveSplitActionResult> => {
      return liveSplitClient.connectLiveSplit().pipe(
        E.as({
          error: undefined,
        }),
        E.catch((error) => {
          return E.succeed({
            error,
          });
        }),
        browserRuntime.runPromise,
      );
    },
    INITIAL_LIVE_SPLIT_ACTION_RESULT,
  );

  const [disconnectState, dispatchDisconnect, isDisconnecting] = useActionState(
    (): Promise<LiveSplitActionResult> => {
      return liveSplitClient.disconnectLiveSplit().pipe(
        E.as({
          error: undefined,
        }),
        E.catch((error) => {
          return E.succeed({
            error,
          });
        }),
        browserRuntime.runPromise,
      );
    },
    INITIAL_LIVE_SPLIT_ACTION_RESULT,
  );

  const contextValue = useMemo<LiveSplitContextValue>(() => {
    return {
      connect: () => {
        startTransition(() => {
          dispatchConnect();
        });
      },
      connectError: connectState.error,
      connectionState: liveSplitSnapshot.connectionState,
      disconnect: () => {
        startTransition(() => {
          dispatchDisconnect();
        });
      },
      disconnectError: disconnectState.error,
      isConnecting,
      isDisconnecting,
      liveSplitStatus: liveSplitSnapshot.liveSplitStatus,
    };
  }, [
    connectState.error,
    disconnectState.error,
    dispatchConnect,
    dispatchDisconnect,
    isConnecting,
    isDisconnecting,
    liveSplitSnapshot.connectionState,
    liveSplitSnapshot.liveSplitStatus,
  ]);

  return (
    <LiveSplitContext.Provider value={contextValue}>
      {children}
    </LiveSplitContext.Provider>
  );
}

function useLiveSplitContext(): LiveSplitContextValue {
  const context = useContext(LiveSplitContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useLiveSplitContext",
      providerName: "LiveSplitProvider",
    });
  }

  return context;
}

export function useLiveSplitActions() {
  const { connect, disconnect } = useLiveSplitContext();

  return {
    connect,
    disconnect,
  };
}

export function useLiveSplitActionState(): LiveSplitActionState {
  const { connectError, disconnectError, isConnecting, isDisconnecting } =
    useLiveSplitContext();

  return {
    connectError,
    disconnectError,
    isConnecting,
    isDisconnecting,
    isPending: isConnecting || isDisconnecting,
  };
}

export function useLiveSplitServerState(): LiveSplitServerState {
  const { connectionState, liveSplitStatus } = useLiveSplitContext();

  return {
    connectionState,
    liveSplitStatus,
  };
}
