import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type DungeonRunObservationApi,
  type DungeonRunStateApi,
} from "@/api/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type ApiEventConnectionState } from "@/electron/renderer/api/common.ts";
import { deleteDungeonRunHistory } from "@/electron/renderer/api/dungeon-run/dungeon-run-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import {
  type DungeonRunEventStore,
  type DungeonRunEventStoreSnapshot,
  dungeonRunEventStore,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { type RouterInvalidationError } from "@/errors/router-invalidation-error.ts";
import {
  type DungeonRunApiHistory,
  type DungeonRunApiObservationStatistics,
} from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import {
  RequirementObservationIdentityFromStringSchema,
  RequirementObservationOccurrenceIdentityFromStringSchema,
} from "@/validation/common/requirement-observation-identity-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";

export type DungeonRunMilestoneKey = string;

type DungeonRunMilestoneExpansionState = {
  readonly defaultIsExpanded: boolean;
  readonly overrides: ReadonlySet<DungeonRunMilestoneKey>;
};

export type DungeonRunDisplayState = {
  readonly collapseAllMilestones: () => void;
  readonly expandAllMilestones: () => void;
  readonly isMilestoneExpanded: (
    milestoneKey: DungeonRunMilestoneKey,
  ) => boolean;
  readonly setMilestoneExpanded: (
    milestoneKey: DungeonRunMilestoneKey,
    isExpanded: boolean,
  ) => void;
};

export type DungeonRunActions = {
  readonly deleteHistoryForConfigurationId: (
    configurationId: ConfigurationId,
  ) => void;
};

export type DungeonRunState = {
  readonly eventConnectionState: ApiEventConnectionState;
  readonly history: DungeonRunApiHistory | null;
  readonly runState: DungeonRunEventStoreSnapshot["runState"];
};

export type DungeonRunStore = DungeonRunActions & DungeonRunState;

type DungeonRunContextValue = DungeonRunDisplayState & DungeonRunStore;

type DungeonRunProviderProps = {
  readonly children: ReactNode;
  readonly eventStore?: DungeonRunEventStore;
  readonly history: DungeonRunApiHistory | null;
  readonly invalidate: () => E.Effect<void, RouterInvalidationError>;
};

export type DungeonRunServerState = {
  readonly dungeonRun: DungeonRunStateApi["dungeonRun"];
  readonly eventConnectionState: ApiEventConnectionState;
  readonly history: DungeonRunApiHistory | null;
  readonly isActiveRun: boolean;
  readonly latestObservation: DungeonRunObservationApi | undefined;
  readonly observations: ReadonlyArray<DungeonRunObservationApi>;
  readonly runState: DungeonRunEventStoreSnapshot["runState"];
};

export type DungeonRunObservationAnalytics = {
  readonly bestElapsedMilliseconds: number;
  readonly meanElapsedMilliseconds: number;
  readonly medianElapsedMilliseconds: number;
  readonly sampleCount: number;
};

export type DungeonRunObservationInterpretation = {
  readonly analytics: DungeonRunObservationAnalytics | undefined;
  readonly elapsedFromPreviousObservationMilliseconds: number | undefined;
  readonly elapsedFromStartMilliseconds: number | undefined;
  readonly observation: DungeonRunObservationApi;
  readonly occurrence: number;
  readonly previousObservation: DungeonRunObservationApi | undefined;
};

export type DungeonRunInterpretationState = {
  readonly latestObservation: DungeonRunObservationInterpretation | undefined;
  readonly observations: ReadonlyArray<DungeonRunObservationInterpretation>;
};

const DungeonRunContext = createContext<DungeonRunContextValue | undefined>(
  undefined,
);

const encodeRequirementObservationIdentity = Schema.encodeSync(
  RequirementObservationIdentityFromStringSchema,
);

const encodeRequirementObservationOccurrenceIdentity = Schema.encodeSync(
  RequirementObservationOccurrenceIdentityFromStringSchema,
);

function createObservationAnalytics(
  statistics: DungeonRunApiObservationStatistics,
): DungeonRunObservationAnalytics {
  return {
    bestElapsedMilliseconds: statistics.bestElapsedMilliseconds,
    meanElapsedMilliseconds: statistics.meanElapsedMilliseconds,
    medianElapsedMilliseconds: statistics.medianElapsedMilliseconds,
    sampleCount: statistics.sampleCount,
  };
}

export function DungeonRunProvider({
  children,
  eventStore = dungeonRunEventStore,
  history,
  invalidate,
}: DungeonRunProviderProps) {
  const dungeonRunSnapshot = useSyncExternalStore(
    eventStore.subscribe,
    eventStore.getSnapshot,
    eventStore.getSnapshot,
  );

  const [
    optimisticallyDeletedConfigurationId,
    setOptimisticallyDeletedConfigurationId,
  ] = useState<ConfigurationId | null>(null);

  const [milestoneExpansionState, setMilestoneExpansionState] =
    useState<DungeonRunMilestoneExpansionState>({
      defaultIsExpanded: false,
      overrides: new Set(),
    });

  const historyForApp =
    history?.configurationId === optimisticallyDeletedConfigurationId
      ? null
      : history;

  const deleteHistoryForConfigurationId = useCallback(
    (configurationId: ConfigurationId) => {
      setOptimisticallyDeletedConfigurationId(configurationId);

      browserRuntime.runFork(
        E.gen(function* () {
          const wasDeleted = yield* deleteDungeonRunHistory({
            configurationId,
          }).pipe(
            E.as(true),
            E.catch((error) => {
              return E.gen(function* () {
                setOptimisticallyDeletedConfigurationId(
                  (deletedConfigurationId) => {
                    return deletedConfigurationId === configurationId
                      ? null
                      : deletedConfigurationId;
                  },
                );

                yield* E.logError("Failed to delete dungeon run history.", {
                  configurationId,
                  error,
                });

                return false;
              });
            }),
          );

          if (!wasDeleted) {
            return;
          }

          yield* invalidate().pipe(
            E.tap(() => {
              return E.sync(() => {
                setOptimisticallyDeletedConfigurationId(
                  (deletedConfigurationId) => {
                    return deletedConfigurationId === configurationId
                      ? null
                      : deletedConfigurationId;
                  },
                );
              });
            }),
            E.catch((error) => {
              return E.logError(
                "Failed to refresh dungeon run history after deletion.",
                {
                  configurationId,
                  error,
                },
              );
            }),
          );
        }),
      );
    },
    [invalidate],
  );

  const expandAllMilestones = useCallback(() => {
    setMilestoneExpansionState({
      defaultIsExpanded: true,
      overrides: new Set(),
    });
  }, []);

  const collapseAllMilestones = useCallback(() => {
    setMilestoneExpansionState({
      defaultIsExpanded: false,
      overrides: new Set(),
    });
  }, []);

  const isMilestoneExpanded = useCallback(
    (milestoneKey: DungeonRunMilestoneKey) => {
      const isOverridden = milestoneExpansionState.overrides.has(milestoneKey);

      return isOverridden
        ? !milestoneExpansionState.defaultIsExpanded
        : milestoneExpansionState.defaultIsExpanded;
    },
    [milestoneExpansionState],
  );

  const setMilestoneExpanded = useCallback(
    (milestoneKey: DungeonRunMilestoneKey, isExpanded: boolean) => {
      setMilestoneExpansionState((currentState) => {
        const overrides = new Set(currentState.overrides);

        if (isExpanded === currentState.defaultIsExpanded) {
          overrides.delete(milestoneKey);
        } else {
          overrides.add(milestoneKey);
        }

        return {
          ...currentState,
          overrides,
        };
      });
    },
    [],
  );

  const contextValue = useMemo<DungeonRunContextValue>(() => {
    return {
      collapseAllMilestones,
      deleteHistoryForConfigurationId,
      eventConnectionState: dungeonRunSnapshot.eventConnectionState,
      expandAllMilestones,
      history: historyForApp,
      isMilestoneExpanded,
      runState: dungeonRunSnapshot.runState,
      setMilestoneExpanded,
    };
  }, [
    collapseAllMilestones,
    deleteHistoryForConfigurationId,
    dungeonRunSnapshot.eventConnectionState,
    dungeonRunSnapshot.runState,
    expandAllMilestones,
    historyForApp,
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

export function useDungeonRunActions(): DungeonRunActions {
  const { deleteHistoryForConfigurationId } = useDungeonRunContext();

  return {
    deleteHistoryForConfigurationId,
  };
}

export function useDungeonRunServerState(): DungeonRunServerState {
  const { eventConnectionState, history, runState } = useDungeonRunContext();

  const dungeonRun = runState?.dungeonRun ?? null;
  const observations = runState?.observations ?? [];

  return {
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
  const { dungeonRun, history, observations } = useDungeonRunServerState();

  return useMemo(() => {
    const historicalStatisticsByKey = A.reduce(
      history?.observations ?? [],
      new Map<string, DungeonRunApiObservationStatistics>(),
      (accumulator, statistics) => {
        const key = encodeRequirementObservationOccurrenceIdentity([
          statistics.type,
          statistics.targetId,
          statistics.occurrence,
        ]);

        accumulator.set(key, statistics);

        return accumulator;
      },
    );

    const interpretationResult = A.reduce(
      observations,
      {
        observations: [] as Array<DungeonRunObservationInterpretation>,
        occurrencesByIdentity: new Map<string, number>(),
      },
      (accumulator, observation) => {
        const observationIdentityKey = encodeRequirementObservationIdentity([
          observation.type,
          observation.targetId,
        ]);

        const occurrence =
          (accumulator.occurrencesByIdentity.get(observationIdentityKey) ?? 0) +
          1;

        accumulator.occurrencesByIdentity.set(
          observationIdentityKey,
          occurrence,
        );

        const previousObservation = A.last(accumulator.observations).pipe(
          Option.getOrUndefined,
        )?.observation;

        const elapsedFromStartMilliseconds =
          dungeonRun?.startedAtMilliseconds === null ||
          dungeonRun?.startedAtMilliseconds === undefined
            ? undefined
            : observation.timestampMilliseconds -
              dungeonRun.startedAtMilliseconds;

        const elapsedFromPreviousObservationMilliseconds =
          previousObservation === undefined
            ? undefined
            : observation.timestampMilliseconds -
              previousObservation.timestampMilliseconds;

        const historicalStatistics = historicalStatisticsByKey.get(
          encodeRequirementObservationOccurrenceIdentity([
            observation.type,
            observation.targetId,
            occurrence,
          ]),
        );

        accumulator.observations.push({
          analytics:
            historicalStatistics === undefined
              ? undefined
              : createObservationAnalytics(historicalStatistics),
          elapsedFromPreviousObservationMilliseconds,
          elapsedFromStartMilliseconds,
          observation,
          occurrence,
          previousObservation,
        });

        return accumulator;
      },
    );

    return {
      latestObservation: A.last(interpretationResult.observations).pipe(
        Option.getOrUndefined,
      ),
      observations: interpretationResult.observations,
    };
  }, [dungeonRun?.startedAtMilliseconds, history, observations]);
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
