import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
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
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";

import {
  type DungeonRunHistoryKey,
  dungeonRunHistoryKeysEqual,
} from "./dungeon-run-history-key.ts";
import {
  createDungeonRunInterpretationState,
  type DungeonRunInterpretationState,
} from "./dungeon-run-interpretation.ts";
import {
  type DungeonRunDisplayState,
  useDungeonRunMilestoneExpansion,
} from "./use-dungeon-run-milestone-expansion.ts";

export type DungeonRunActions = {
  readonly deleteHistory: () => void;
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
  readonly historyKey: DungeonRunHistoryKey | null;
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

const DungeonRunContext = createContext<DungeonRunContextValue | undefined>(
  undefined,
);

export function DungeonRunProvider({
  children,
  eventStore = dungeonRunEventStore,
  history,
  historyKey,
  invalidate,
}: DungeonRunProviderProps) {
  const dungeonRunSnapshot = useSyncExternalStore(
    eventStore.subscribe,
    eventStore.getSnapshot,
    eventStore.getSnapshot,
  );

  const [optimisticallyDeletedHistoryKey, setOptimisticallyDeletedHistoryKey] =
    useState<DungeonRunHistoryKey | null>(null);

  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunMilestoneExpansion();

  const historyForApp = dungeonRunHistoryKeysEqual(
    historyKey,
    optimisticallyDeletedHistoryKey,
  )
    ? null
    : history;

  const deleteHistory = useCallback(() => {
    if (historyKey === null) {
      return;
    }

    const deletedHistoryKey = historyKey;

    setOptimisticallyDeletedHistoryKey(deletedHistoryKey);

    browserRuntime.runFork(
      E.gen(function* () {
        const wasDeleted = yield* deleteDungeonRunHistory({
          dungeonId: deletedHistoryKey.dungeonId,
          dungeonLevel: deletedHistoryKey.dungeonLevel,
        }).pipe(
          E.as(true),
          E.catch((error) => {
            return E.gen(function* () {
              setOptimisticallyDeletedHistoryKey((currentHistoryKey) => {
                return dungeonRunHistoryKeysEqual(
                  currentHistoryKey,
                  deletedHistoryKey,
                )
                  ? null
                  : currentHistoryKey;
              });

              yield* E.logError("Failed to delete dungeon run history.", {
                dungeonId: deletedHistoryKey.dungeonId,
                dungeonLevel: deletedHistoryKey.dungeonLevel,
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
              setOptimisticallyDeletedHistoryKey((currentHistoryKey) => {
                return dungeonRunHistoryKeysEqual(
                  currentHistoryKey,
                  deletedHistoryKey,
                )
                  ? null
                  : currentHistoryKey;
              });
            });
          }),
          E.catch((error) => {
            return E.logError(
              "Failed to refresh dungeon run history after deletion.",
              {
                dungeonId: deletedHistoryKey.dungeonId,
                dungeonLevel: deletedHistoryKey.dungeonLevel,
                error,
              },
            );
          }),
        );
      }),
    );
  }, [historyKey, invalidate]);

  const contextValue = useMemo<DungeonRunContextValue>(() => {
    return {
      collapseAllMilestones,
      deleteHistory,
      eventConnectionState: dungeonRunSnapshot.eventConnectionState,
      expandAllMilestones,
      history: historyForApp,
      isMilestoneExpanded,
      runState: dungeonRunSnapshot.runState,
      setMilestoneExpanded,
    };
  }, [
    collapseAllMilestones,
    deleteHistory,
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
  const { deleteHistory } = useDungeonRunContext();

  return {
    deleteHistory,
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
    return createDungeonRunInterpretationState({
      dungeonRun,
      history,
      observations,
    });
  }, [dungeonRun, history, observations]);
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
