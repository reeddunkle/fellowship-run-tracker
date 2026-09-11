import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";

import { type CompiledConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import {
  type DungeonRunProcessingRunState,
  type DungeonRunProcessingState,
} from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import { trackDungeonRunEvent } from "@/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import {
  type DungeonRunObservation,
  type ProcessRequirementEventResult,
  processRequirementEvent,
  type SatisfiedRequirement,
} from "@/services/fellowship/requirements/process-requirement-event.ts";
import { initialRequirementProcessorState } from "@/services/fellowship/requirements/requirement-processor-state.ts";
import { type FellowshipRunMilestone } from "@/services/fellowship/types.ts";
import { doesDungeonRunMatchConfiguration } from "@/services/fellowship/utilities/does-dungeon-run-match-configuration.ts";
import { isDungeonExitEvent } from "@/services/fellowship/utilities/is-dungeon-exit-event.ts";
import { type DungeonStartEvent } from "@/services/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";

export const DUNGEON_RUN_PROCESSING_EVENT = {
  MILESTONE_COMPLETED: "MILESTONE_COMPLETED",
  REQUIREMENT_SATISFIED: "REQUIREMENT_SATISFIED",
  RUN_COMPLETED: "RUN_COMPLETED",
  RUN_EXITED: "RUN_EXITED",
  RUN_STARTED: "RUN_STARTED",
} as const;

export type DungeonRunProcessingEvent =
  | {
      readonly milestone: FellowshipRunMilestone;
      readonly type: typeof DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED;
    }
  | {
      readonly requirement: SatisfiedRequirement;
      readonly type: typeof DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED;
    }
  | {
      readonly timestamp: DateTime.Utc;
      readonly type: typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED;
    }
  | {
      readonly timestamp: DateTime.Utc;
      readonly type: typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED;
    }
  | {
      readonly timestamp: DateTime.Utc;
      readonly type: typeof DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED;
    };

export type ProcessDungeonRunEventOptions = {
  readonly configuration: CompiledConfiguration;
  readonly event: FellowshipEvent;
  readonly state: DungeonRunProcessingState;
};

export type ProcessDungeonRunEventResult = {
  readonly observation: DungeonRunObservation | undefined;
  readonly processingEvents: ReadonlyArray<DungeonRunProcessingEvent>;
  readonly state: DungeonRunProcessingState;
};

function doesDungeonRunStartMatchConfiguration({
  configuration,
  runStart,
}: {
  readonly configuration: CompiledConfiguration;
  readonly runStart: DungeonStartEvent;
}): boolean {
  return doesDungeonRunMatchConfiguration({
    configuration,
    run: {
      start: runStart,
    },
  });
}

function getEventTimestamp(event: FellowshipEvent): DateTime.Utc {
  return event.type === FELLOWSHIP_EVENT.DUNGEON_START
    ? event.startedAt
    : event.timestamp;
}

function getNextDungeonRunState({
  currentRunStart,
  hasCompletedConfiguredRun,
  hasExitedConfiguredRun,
  isConfiguredDungeonStart,
  state,
  timestamp,
}: {
  readonly currentRunStart: DungeonStartEvent | undefined;
  readonly hasCompletedConfiguredRun: boolean;
  readonly hasExitedConfiguredRun: boolean;
  readonly isConfiguredDungeonStart: boolean;
  readonly state: DungeonRunProcessingState;
  readonly timestamp: DateTime.Utc;
}): DungeonRunProcessingRunState | undefined {
  if (isConfiguredDungeonStart) {
    return {
      startedAt: timestamp,
      status: "ACTIVE",
    };
  }

  if (hasCompletedConfiguredRun && currentRunStart !== undefined) {
    return {
      endedAt: timestamp,
      startedAt: currentRunStart.startedAt,
      status: "COMPLETED",
    };
  }

  if (hasExitedConfiguredRun && currentRunStart !== undefined) {
    return {
      endedAt: timestamp,
      startedAt: currentRunStart.startedAt,
      status: "EXITED",
    };
  }

  return state.dungeonRun;
}

export function processDungeonRunEvent({
  configuration,
  event,
  state,
}: ProcessDungeonRunEventOptions): ProcessDungeonRunEventResult {
  const isDungeonStart = event.type === FELLOWSHIP_EVENT.DUNGEON_START;

  const isConfiguredDungeonStart =
    isDungeonStart &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: event,
    });

  const currentRunStart = state.runTracker.currentStart;

  const wasConfiguredRunActive =
    currentRunStart !== undefined &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: currentRunStart,
    });

  const hasExitedConfiguredRun =
    wasConfiguredRunActive &&
    isDungeonExitEvent({
      event,
      runStart: currentRunStart,
    });

  const trackerResult = trackDungeonRunEvent({
    event,
    state: state.runTracker,
  });

  const hasCompletedConfiguredRun =
    wasConfiguredRunActive && trackerResult.completedRun !== undefined;

  const timestamp = getEventTimestamp(event);

  const requirementProcessor = isConfiguredDungeonStart
    ? initialRequirementProcessorState
    : state.requirementProcessor;

  const runStart = isConfiguredDungeonStart
    ? event
    : (trackerResult.completedRun?.start ?? currentRunStart);

  const canProcessRequirement =
    runStart !== undefined &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart,
    });

  const requirementResult: ProcessRequirementEventResult = canProcessRequirement
    ? processRequirementEvent({
        configuration,
        event,
        runStart,
        state: requirementProcessor,
      })
    : {
        completedMilestones: [],
        observation: undefined,
        satisfiedRequirements: [],
        state: requirementProcessor,
      };

  const runStartedProcessingEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    isConfiguredDungeonStart
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
          },
        ]
      : [];

  const requirementSatisfiedProcessingEvents = A.map(
    requirementResult.satisfiedRequirements,
    (satisfiedRequirement): DungeonRunProcessingEvent => {
      return {
        requirement: satisfiedRequirement,
        type: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
      };
    },
  );

  const milestoneCompletedProcessingEvents = A.map(
    requirementResult.completedMilestones,
    (completedMilestone): DungeonRunProcessingEvent => {
      return {
        milestone: completedMilestone,
        type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
      };
    },
  );

  const runCompletedProcessingEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    hasCompletedConfiguredRun
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
          },
        ]
      : [];

  const runExitedProcessingEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    hasExitedConfiguredRun
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
          },
        ]
      : [];

  const dungeonRun = getNextDungeonRunState({
    currentRunStart,
    hasCompletedConfiguredRun,
    hasExitedConfiguredRun,
    isConfiguredDungeonStart,
    state,
    timestamp,
  });

  return {
    observation: requirementResult.observation,
    processingEvents: [
      ...runStartedProcessingEvents,
      ...requirementSatisfiedProcessingEvents,
      ...milestoneCompletedProcessingEvents,
      ...runCompletedProcessingEvents,
      ...runExitedProcessingEvents,
    ],
    state: {
      dungeonRun,
      requirementProcessor: requirementResult.state,
      runTracker: trackerResult.state,
    },
  };
}
