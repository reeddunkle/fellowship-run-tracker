import type * as DateTime from "effect/DateTime";

import {
  type ConfiguredDungeonRunProcessingState,
  createInitialConfiguredDungeonRunProcessingState,
  interruptConfiguredDungeonRunProcessingState,
} from "@frt/api/services/fellowship/dungeon-runs/configured-dungeon-run-processing-state.ts";
import {
  type DungeonRunTrackerState,
  initialDungeonRunTrackerState,
} from "@frt/api/services/fellowship/dungeon-runs/track-dungeon-run.ts";

export type DungeonRunProcessingState = {
  readonly configuredRun: ConfiguredDungeonRunProcessingState;
  readonly runTracker: DungeonRunTrackerState;
};

export function createInitialDungeonRunProcessingState(): DungeonRunProcessingState {
  return {
    configuredRun: createInitialConfiguredDungeonRunProcessingState(),
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
  return {
    ...state,
    configuredRun: interruptConfiguredDungeonRunProcessingState({
      endedAt,
      state: state.configuredRun,
    }),
  };
}
