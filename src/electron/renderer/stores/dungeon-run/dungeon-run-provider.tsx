import * as A from "effect/Array";
import * as Option from "effect/Option";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  type DungeonRunObservationApi,
  type DungeonRunStateApi,
} from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type TrackingApiStatus } from "@/application/fellowship-tracker/tracking-api-schema.ts";
import {
  useDungeonRunComparisonGroup,
  useSelectedConfigurationId,
} from "@/electron/renderer/api/app-state/app-state-queries.ts";
import {
  API_EVENT_CONNECTION_STATE,
  type ApiEventConnectionState,
} from "@/electron/renderer/api/common.ts";
import { useConfigurationsQuery } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import {
  useDungeonRunHistoryQuery,
  useInvalidateDungeonRunHistory,
} from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import {
  type DungeonRunEventStore,
  type DungeonRunEventStoreSnapshot,
  dungeonRunEventStore,
} from "@/electron/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import {
  trackingEventStore as defaultTrackingEventStore,
  type TrackingEventStore,
} from "@/electron/renderer/stores/tracking/tracking-event-store.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
} from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

import { type DungeonRunHistoryKey } from "./dungeon-run-history-key.ts";
import {
  createDungeonRunInterpretationState,
  type DungeonRunInterpretationState,
} from "./dungeon-run-interpretation.ts";
import {
  type DungeonRunDisplayState,
  useDungeonRunMilestoneExpansion,
} from "./use-dungeon-run-milestone-expansion.ts";

function getHistoryConfigurationId({
  runState,
  selectedConfigurationId,
  trackingStatus,
}: {
  readonly runState: DungeonRunStateApi | null;
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly trackingStatus: TrackingApiStatus | null;
}): ConfigurationId | null {
  if (
    runState?.dungeonRun?.status === "ACTIVE" &&
    trackingStatus?.status === "Tracking" &&
    trackingStatus.source.type === "Persisted"
  ) {
    return trackingStatus.source.configurationId;
  }

  return selectedConfigurationId;
}

type DungeonRunState = {
  readonly comparisonGroup: DungeonRunApiComparisonGroup;
  readonly eventConnectionState: ApiEventConnectionState;
  readonly history: DungeonRunApiHistory | null;
  readonly runState: DungeonRunEventStoreSnapshot["runState"];
};

type DungeonRunContextValue = DungeonRunDisplayState & DungeonRunState;

type DungeonRunProviderProps = {
  readonly children: ReactNode;
  readonly eventStore?: DungeonRunEventStore;
  readonly trackingEventStore?: TrackingEventStore;
};

type DungeonRunServerState = {
  readonly comparisonGroup: DungeonRunApiComparisonGroup;
  readonly dungeonRun: DungeonRunStateApi["dungeonRun"];
  readonly eventConnectionState: ApiEventConnectionState;
  readonly history: DungeonRunApiHistory | null;
  readonly isActiveRun: boolean;
  readonly latestObservation: DungeonRunObservationApi | undefined;
  readonly observations: ReadonlyArray<DungeonRunObservationApi>;
  readonly runState: DungeonRunEventStoreSnapshot["runState"];
};

const DungeonRunContext = createContext<DungeonRunContextValue | undefined>(
  undefined,
);

type DungeonRunSources = {
  readonly eventStore: DungeonRunEventStore;
  readonly trackingEventStore: TrackingEventStore;
};

const DungeonRunSourcesContext = createContext<DungeonRunSources | undefined>(
  undefined,
);

export function DungeonRunProvider({
  children,
  eventStore = dungeonRunEventStore,
  trackingEventStore: trackingEventStoreOverride = defaultTrackingEventStore,
}: DungeonRunProviderProps) {
  const comparisonGroup = useDungeonRunComparisonGroup();

  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunMilestoneExpansion();

  const contextValue = useMemo<DungeonRunContextValue>(() => {
    return {
      collapseAllMilestones,
      comparisonGroup,
      eventConnectionState: API_EVENT_CONNECTION_STATE.DISCONNECTED,
      expandAllMilestones,
      history: null,
      isMilestoneExpanded,
      runState: null,
      setMilestoneExpanded,
    };
  }, [
    collapseAllMilestones,
    comparisonGroup,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  ]);

  return (
    <DungeonRunSourcesContext.Provider
      value={{
        eventStore,
        trackingEventStore: trackingEventStoreOverride,
      }}
    >
      <DungeonRunContext.Provider value={contextValue}>
        {children}
      </DungeonRunContext.Provider>
    </DungeonRunSourcesContext.Provider>
  );
}

function useDungeonRunSources(): DungeonRunSources {
  const sources = useContext(DungeonRunSourcesContext);

  if (sources === undefined) {
    throw new ReactContextError({
      hookName: "useDungeonRunSources",
      providerName: "DungeonRunProvider",
    });
  }

  return sources;
}

function useDungeonRunContext(): DungeonRunContextValue {
  const context = useContext(DungeonRunContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useDungeonRunContext",
      providerName: "DungeonRunProvider",
    });
  }

  return context;
}

export function useDungeonRunServerState(): DungeonRunServerState {
  const { eventStore, trackingEventStore } = useDungeonRunSources();
  const invalidateDungeonRunHistory = useInvalidateDungeonRunHistory();
  const subscribeToDungeonRunEvents = useCallback(
    (onStoreChange: () => void) => {
      const unsubscribeSnapshot = eventStore.subscribe(onStoreChange);
      const unsubscribeRunFinished = eventStore.onRunFinished(
        invalidateDungeonRunHistory,
      );

      return () => {
        unsubscribeSnapshot();
        unsubscribeRunFinished();
      };
    },
    [eventStore, invalidateDungeonRunHistory],
  );
  const dungeonRunSnapshot = useSyncExternalStore(
    subscribeToDungeonRunEvents,
    eventStore.getSnapshot,
    eventStore.getSnapshot,
  );
  const trackingSnapshot = useSyncExternalStore(
    trackingEventStore.subscribe,
    trackingEventStore.getSnapshot,
    trackingEventStore.getSnapshot,
  );
  const comparisonGroup = useDungeonRunComparisonGroup();
  const selectedConfigurationId = useSelectedConfigurationId();
  const { data: configurations } = useConfigurationsQuery();
  const historyConfigurationId = getHistoryConfigurationId({
    runState: dungeonRunSnapshot.runState,
    selectedConfigurationId,
    trackingStatus: trackingSnapshot.trackingStatus,
  });
  const historyConfiguration = (configurations ?? []).find((configuration) => {
    return configuration.id === historyConfigurationId;
  });
  const historyKey: DungeonRunHistoryKey | null =
    historyConfigurationId === null || historyConfiguration === undefined
      ? null
      : {
          dungeonId: historyConfiguration.dungeonId,
          dungeonLevel: historyConfiguration.dungeonLevel,
        };
  const historyQuery = useDungeonRunHistoryQuery(historyKey);
  const history = historyQuery.data ?? null;
  const eventConnectionState = dungeonRunSnapshot.eventConnectionState;
  const runState = dungeonRunSnapshot.runState;

  const dungeonRun = runState?.dungeonRun ?? null;
  const observations = runState?.observations ?? [];

  return {
    comparisonGroup,
    dungeonRun,
    eventConnectionState,
    history,
    isActiveRun: dungeonRun?.status === "ACTIVE",
    latestObservation: A.last(observations).pipe(Option.getOrUndefined),
    observations,
    runState,
  };
}

export function useDungeonRunInterpretationState(): DungeonRunInterpretationState {
  const { comparisonGroup, dungeonRun, history, observations } =
    useDungeonRunServerState();

  return useMemo(() => {
    return createDungeonRunInterpretationState({
      comparisonGroup,
      dungeonRun,
      history,
      observations,
    });
  }, [comparisonGroup, dungeonRun, history, observations]);
}

export function useDungeonRunDisplayState(): DungeonRunDisplayState {
  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunContext();

  return {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  };
}
