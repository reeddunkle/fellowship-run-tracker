import type * as DateTime from "effect/DateTime";

import {
  initialRequirementProcessorState,
  type RequirementProcessorState,
} from "@frt/api/services/fellowship/requirements/requirement-processor-state.ts";

export type ConfiguredDungeonRunState =
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

export type ConfiguredDungeonRunProcessingState = {
  readonly dungeonRun: ConfiguredDungeonRunState | undefined;
  readonly requirementProcessor: RequirementProcessorState;
};

export function createInitialConfiguredDungeonRunProcessingState(): ConfiguredDungeonRunProcessingState {
  return {
    dungeonRun: undefined,
    requirementProcessor: initialRequirementProcessorState,
  };
}

export function interruptConfiguredDungeonRunProcessingState({
  endedAt,
  state,
}: {
  readonly endedAt: DateTime.Utc;
  readonly state: ConfiguredDungeonRunProcessingState;
}): ConfiguredDungeonRunProcessingState {
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
