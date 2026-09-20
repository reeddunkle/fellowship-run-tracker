import { useQuery } from "@tanstack/react-query";
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
import { type ApiEventConnectionState } from "@/electron/renderer/api/common.ts";
import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import {
  getDungeonRunHistoryQueryOptions,
  useInvalidateDungeonRunHistory,
} from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import {
  type AppStore,
  appStore,
} from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { useAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import {
  type DungeonRunEventStore,
  type DungeonRunEventStoreSnapshot,
  dungeonRunEventStore,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import {
  trackingEventStore as defaultTrackingEventStore,
  type TrackingEventStore,
} from "@/electron/renderer/stores/tracking-store/tracking-event-store.ts";
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

export type DungeonRunState = {
  readonly comparisonGroup: DungeonRunApiComparisonGroup;
  readonly eventConnectionState: ApiEventConnectionState;
  readonly history: DungeonRunApiHistory | null;
  readonly runState: DungeonRunEventStoreSnapshot["runState"];
};

type DungeonRunContextValue = DungeonRunDisplayState & DungeonRunState;

type DungeonRunProviderProps = {
  readonly appStore?: AppStore;
  readonly children: ReactNode;
  readonly eventStore?: DungeonRunEventStore;
  readonly trackingEventStore?: TrackingEventStore;
};

export type DungeonRunServerState = {
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

export function DungeonRunProvider({
  appStore: appStoreOverride = appStore,
  children,
  eventStore = dungeonRunEventStore,
  trackingEventStore: trackingEventStoreOverride = defaultTrackingEventStore,
}: DungeonRunProviderProps) {
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
    trackingEventStoreOverride.subscribe,
    trackingEventStoreOverride.getSnapshot,
    trackingEventStoreOverride.getSnapshot,
  );

  const { dungeonRun: dungeonRunAppState, selectedConfigurationId } =
    useAppStore(appStoreOverride);

  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunMilestoneExpansion();

  const { data: configurations } = useQuery(getConfigurationsQueryOptions());

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

  const historyQuery = useQuery({
    ...getDungeonRunHistoryQueryOptions({
      dungeonId: historyKey?.dungeonId ?? "0",
      dungeonLevel: historyKey?.dungeonLevel ?? 1,
    }),
    enabled: historyKey !== null,
  });

  const history = historyQuery.data ?? null;

  const contextValue = useMemo<DungeonRunContextValue>(() => {
    return {
      collapseAllMilestones,
      comparisonGroup: dungeonRunAppState.comparisonGroup,
      eventConnectionState: dungeonRunSnapshot.eventConnectionState,
      expandAllMilestones,
      history,
      isMilestoneExpanded,
      runState: dungeonRunSnapshot.runState,
      setMilestoneExpanded,
    };
  }, [
    collapseAllMilestones,
    dungeonRunAppState.comparisonGroup,
    dungeonRunSnapshot.eventConnectionState,
    dungeonRunSnapshot.runState,
    expandAllMilestones,
    history,
    isMilestoneExpanded,
    setMilestoneExpanded,
  ]);

  return (
    <DungeonRunContext.Provider value={contextValue}>
      {children}
    </DungeonRunContext.Provider>
  );
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
  const { comparisonGroup, eventConnectionState, history, runState } =
    useDungeonRunContext();

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
