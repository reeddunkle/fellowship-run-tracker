import * as A from "effect/Array";
import * as Option from "effect/Option";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { type TrackingApiStatus } from "@frt/api-contract/application/fellowship-tracker/tracking-api-schema.ts";
import {
  type DungeonRunObservationApi,
  type DungeonRunStateApi,
} from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";
import {
  type DungeonRunApiComparisonGroup,
  type DungeonRunApiHistory,
} from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

import {
  useDungeonRunComparisonGroup,
  useSelectedConfigurationId,
} from "@/renderer/api/app-state/app-state-queries.ts";
import { type ApiEventConnectionState } from "@/renderer/api/common.ts";
import { useConfigurationsQuery } from "@/renderer/api/configuration/configuration-queries.ts";
import { useDungeonRunHistoryQuery } from "@/renderer/api/dungeon-run/dungeon-run-queries.ts";
import {
  type DungeonRunEventStore,
  type DungeonRunEventStoreSnapshot,
  dungeonRunEventStore,
} from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import {
  trackingEventStore as defaultTrackingEventStore,
  type TrackingEventStore,
} from "@/renderer/stores/tracking/tracking-event-store.ts";

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

const DungeonRunContext = createContext<DungeonRunDisplayState | undefined>(
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
  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunMilestoneExpansion();

  const contextValue = useMemo<DungeonRunDisplayState>(() => {
    return {
      collapseAllMilestones,
      expandAllMilestones,
      isMilestoneExpanded,
      setMilestoneExpanded,
    };
  }, [
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  ]);

  const sources = useMemo<DungeonRunSources>(() => {
    return {
      eventStore,
      trackingEventStore: trackingEventStoreOverride,
    };
  }, [eventStore, trackingEventStoreOverride]);

  return (
    <DungeonRunSourcesContext value={sources}>
      <DungeonRunContext value={contextValue}>{children}</DungeonRunContext>
    </DungeonRunSourcesContext>
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

function useDungeonRunContext(): DungeonRunDisplayState {
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
  const dungeonRunSnapshot = useSyncExternalStore(
    eventStore.subscribe,
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
  return useDungeonRunContext();
}
