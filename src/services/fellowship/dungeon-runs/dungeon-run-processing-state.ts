import type * as DateTime from "effect/DateTime";

import {
  type DungeonRunTrackerState,
  initialDungeonRunTrackerState,
} from "@/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import {
  initialRequirementProcessorState,
  type RequirementProcessorState,
} from "@/services/fellowship/requirements/requirement-processor-state.ts";

export type DungeonRunProcessingRunState =
  | {
      readonly startedAt: DateTime.Utc;
      readonly status: "ACTIVE";
    }
  | {
      readonly endedAt: DateTime.Utc;
      readonly startedAt: DateTime.Utc;
      readonly status: "COMPLETED";
    }
  | {
      readonly endedAt: DateTime.Utc;
      readonly startedAt: DateTime.Utc;
      readonly status: "EXITED";
    }
  | {
      readonly endedAt: DateTime.Utc;
      readonly startedAt: DateTime.Utc;
      readonly status: "INTERRUPTED";
    };

export type DungeonRunProcessingState = {
  readonly dungeonRun: DungeonRunProcessingRunState | undefined;
  readonly requirementProcessor: RequirementProcessorState;
  readonly runTracker: DungeonRunTrackerState;
};

export function createInitialDungeonRunState(): DungeonRunProcessingState {
  return {
    dungeonRun: undefined,
    requirementProcessor: initialRequirementProcessorState,
    runTracker: initialDungeonRunTrackerState,
  };
}

export function interruptDungeonRunProcessingState({
  endedAt,
  state,
}: {
  readonly endedAt: DateTime.Utc;
  readonly state: DungeonRunProcessingState;
}): DungeonRunProcessingState {
  if (state.dungeonRun?.status !== "ACTIVE") {
    return state;
  }

  return {
    ...state,
    dungeonRun: {
      endedAt,
      startedAt: state.dungeonRun.startedAt,
      status: "INTERRUPTED",
    },
  };
}
