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

import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";
import { type ConfigurationId } from "@frt/shared/validation/configuration/configuration-id-schema.ts";
import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

import { type ApiEventConnectionState } from "@/renderer/api/common.ts";
import * as trackingClient from "@/renderer/api/tracking/tracking-client.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";
import { trackingEventStore } from "@/renderer/stores/tracking/tracking-event-store.ts";

type StartTrackingActionInput = {
  readonly configurationId: ConfigurationId;
};

type TrackingActionResult = {
  readonly error: unknown | undefined;
};

type TrackingContextValue = {
  readonly isStarting: boolean;
  readonly isStopping: boolean;
  readonly start: (configurationId: ConfigurationId) => void;
  readonly startError: unknown | undefined;
  readonly stop: () => void;
  readonly stopError: unknown | undefined;
};

type TrackingProviderProps = {
  readonly children: ReactNode;
};

type TrackingActionState = {
  readonly isPending: boolean;
  readonly isStarting: boolean;
  readonly isStopping: boolean;
  readonly startError: unknown | undefined;
  readonly stopError: unknown | undefined;
};

type TrackingServerState = {
  readonly eventConnectionState: ApiEventConnectionState;
  readonly trackingStatus: TrackingApiStatus | null;
};

const INITIAL_TRACKING_ACTION_RESULT: TrackingActionResult = {
  error: undefined,
};

const TrackingContext = createContext<TrackingContextValue | undefined>(
  undefined,
);

export function TrackingProvider({ children }: TrackingProviderProps) {
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
    };
  }, [
    dispatchStart,
    dispatchStop,
    isStarting,
    isStopping,
    startState.error,
    stopState.error,
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
  const { eventConnectionState, trackingStatus } = useSyncExternalStore(
    trackingEventStore.subscribe,
    trackingEventStore.getSnapshot,
  );

  return {
    eventConnectionState,
    trackingStatus,
  };
}
