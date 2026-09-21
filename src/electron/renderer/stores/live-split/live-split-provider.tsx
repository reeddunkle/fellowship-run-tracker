import * as E from "effect/Effect";
import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { type LiveSplitApiStatus } from "@/contracts/live-split/live-split-api-schema.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/electron/renderer/api/common.ts";
import * as liveSplitClient from "@/electron/renderer/api/live-split/live-split-client.ts";
import { useAppSettings } from "@/electron/renderer/components/providers/settings-provider.tsx";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";

import {
  type LiveSplitEventStoreSnapshot,
  liveSplitEventStore,
} from "./live-split-event-store.ts";

type LiveSplitActionResult = {
  readonly error: unknown | undefined;
};

type LiveSplitContextValue = {
  readonly connect: () => void;
  readonly connectError: unknown | undefined;
  readonly disconnect: () => void;
  readonly disconnectError: unknown | undefined;
  readonly isConnecting: boolean;
  readonly isDisconnecting: boolean;
};

type LiveSplitProviderProps = {
  readonly children: ReactNode;
};

type LiveSplitActionState = {
  readonly connectError: unknown | undefined;
  readonly disconnectError: unknown | undefined;
  readonly isConnecting: boolean;
  readonly isDisconnecting: boolean;
  readonly isPending: boolean;
};

type LiveSplitServerState = {
  readonly eventConnectionState: ApiEventConnectionState;
  readonly serverStatus: LiveSplitApiStatus | null;
};

const INITIAL_LIVE_SPLIT_ACTION_RESULT: LiveSplitActionResult = {
  error: undefined,
};

const DISABLED_LIVE_SPLIT_SNAPSHOT: LiveSplitEventStoreSnapshot = {
  eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
  serverStatus: null,
};

const LiveSplitContext = createContext<LiveSplitContextValue | undefined>(
  undefined,
);

export function LiveSplitProvider({ children }: LiveSplitProviderProps) {
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
      disconnect: () => {
        startTransition(() => {
          dispatchDisconnect();
        });
      },
      disconnectError: disconnectState.error,
      isConnecting,
      isDisconnecting,
    };
  }, [
    connectState.error,
    disconnectState.error,
    dispatchConnect,
    dispatchDisconnect,
    isConnecting,
    isDisconnecting,
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
  const appSettings = useAppSettings();

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!appSettings.isLiveSplitEnabled) {
        return () => {};
      }

      return liveSplitEventStore.subscribe(listener);
    },
    [appSettings.isLiveSplitEnabled],
  );

  const getSnapshot = useCallback(() => {
    if (!appSettings.isLiveSplitEnabled) {
      return DISABLED_LIVE_SPLIT_SNAPSHOT;
    }

    return liveSplitEventStore.getSnapshot();
  }, [appSettings.isLiveSplitEnabled]);

  const { eventConnectionState, serverStatus } = useSyncExternalStore(
    subscribe,
    getSnapshot,
  );

  return {
    eventConnectionState,
    serverStatus,
  };
}
