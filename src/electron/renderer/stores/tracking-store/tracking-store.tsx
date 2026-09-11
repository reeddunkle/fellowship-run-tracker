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

import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import { type ApiConnectionState } from "@/electron/renderer/api/common.ts";
import * as trackingClient from "@/electron/renderer/api/tracking/tracking-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { trackingEventStore } from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

type StartTrackingActionInput = {
  readonly configurationId: ConfigurationId;
};

type TrackingActionResult = {
  readonly error: unknown | undefined;
};

type TrackingContextValue = {
  readonly connectionState: ApiConnectionState;
  readonly isStarting: boolean;
  readonly isStopping: boolean;
  readonly start: (configurationId: ConfigurationId) => void;
  readonly startError: unknown | undefined;
  readonly stop: () => void;
  readonly stopError: unknown | undefined;
  readonly trackingStatus: TrackingApiStatus | null;
};

type TrackingProviderProps = {
  readonly children: ReactNode;
};

export type TrackingActionState = {
  readonly isPending: boolean;
  readonly isStarting: boolean;
  readonly isStopping: boolean;
  readonly startError: unknown | undefined;
  readonly stopError: unknown | undefined;
};

export type TrackingServerState = {
  readonly connectionState: ApiConnectionState;
  readonly trackingStatus: TrackingApiStatus | null;
};

const INITIAL_TRACKING_ACTION_RESULT: TrackingActionResult = {
  error: undefined,
};

const TrackingContext = createContext<TrackingContextValue | undefined>(
  undefined,
);

export function TrackingProvider({ children }: TrackingProviderProps) {
  const trackingSnapshot = useSyncExternalStore(
    trackingEventStore.subscribe,
    trackingEventStore.getSnapshot,
  );

  const [startState, dispatchStart, isStarting] = useActionState(
    (
      _previousState: TrackingActionResult,
      input: StartTrackingActionInput,
    ): Promise<TrackingActionResult> => {
      return trackingClient
        .startTracking({
          configurationId: input.configurationId,
        })
        .pipe(
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
    INITIAL_TRACKING_ACTION_RESULT,
  );

  const [stopState, dispatchStop, isStopping] = useActionState(
    (): Promise<TrackingActionResult> => {
      return trackingClient.stopTracking().pipe(
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
    INITIAL_TRACKING_ACTION_RESULT,
  );

  const contextValue = useMemo<TrackingContextValue>(() => {
    return {
      connectionState: trackingSnapshot.connectionState,
      isStarting,
      isStopping,
      start: (configurationId) => {
        startTransition(() => {
          dispatchStart({
            configurationId,
          });
        });
      },
      startError: startState.error,
      stop: () => {
        startTransition(() => {
          dispatchStop();
        });
      },
      stopError: stopState.error,
      trackingStatus: trackingSnapshot.trackingStatus,
    };
  }, [
    dispatchStart,
    dispatchStop,
    isStarting,
    isStopping,
    startState.error,
    stopState.error,
    trackingSnapshot.connectionState,
    trackingSnapshot.trackingStatus,
  ]);

  return (
    <TrackingContext.Provider value={contextValue}>
      {children}
    </TrackingContext.Provider>
  );
}

function useTrackingContext(): TrackingContextValue {
  const context = useContext(TrackingContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useTrackingContext",
      providerName: "TrackingProvider",
    });
  }

  return context;
}

export function useTrackingActions() {
  const { start, stop } = useTrackingContext();

  return {
    start,
    stop,
  };
}

export function useTrackingActionState(): TrackingActionState {
  const { isStarting, isStopping, startError, stopError } =
    useTrackingContext();

  return {
    isPending: isStarting || isStopping,
    isStarting,
    isStopping,
    startError,
    stopError,
  };
}

export function useTrackingServerState(): TrackingServerState {
  const { connectionState, trackingStatus } = useTrackingContext();

  return {
    connectionState,
    trackingStatus,
  };
}
