import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";

import { type ConfiguredDungeonRunState } from "@frt/api/services/fellowship/dungeon-runs/configured-dungeon-run-processing-state.ts";
import { type DungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type DungeonRunTrackerResult,
  trackDungeonRunEvent,
} from "@frt/api/services/fellowship/dungeon-runs/track-dungeon-run.ts";
import { type DungeonRunObservation } from "@frt/api/services/fellowship/requirements/create-dungeon-run-observation.ts";
import {
  type ProcessRequirementEventResult,
  processRequirementEvent,
  type SatisfiedRequirement,
} from "@frt/api/services/fellowship/requirements/process-requirement-event.ts";
import {
  initialRequirementProcessorState,
  type RequirementProcessorState,
} from "@frt/api/services/fellowship/requirements/requirement-processor-state.ts";
import { type FellowshipRunMilestone } from "@frt/api/services/fellowship/types.ts";
import { doesDungeonRunMatchConfiguration } from "@frt/api/services/fellowship/utilities/does-dungeon-run-match-configuration.ts";
import { type CompiledConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

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

type ConfiguredDungeonRunTransition = {
  readonly hasCompletedRun: boolean;
  readonly hasExitedRun: boolean;
  readonly hasStartedRun: boolean;
  readonly runStart: DungeonStartEvent | undefined;
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

function getConfiguredDungeonRunTransition({
  configuration,
  previousRunStart,
  trackerResult,
}: {
  readonly configuration: CompiledConfiguration;
  readonly previousRunStart: DungeonStartEvent | undefined;
  readonly trackerResult: DungeonRunTrackerResult;
}): ConfiguredDungeonRunTransition {
  const hasStartedRun =
    trackerResult.startedRun !== undefined &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: trackerResult.startedRun,
    });

  const hasCompletedRun =
    trackerResult.completedRun !== undefined &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: trackerResult.completedRun.start,
    });

  const hasExitedRun =
    trackerResult.exitedRunStart !== undefined &&
    doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: trackerResult.exitedRunStart,
    });

  const runStart =
    trackerResult.startedRun ??
    trackerResult.completedRun?.start ??
    trackerResult.exitedRunStart ??
    previousRunStart;

  return {
    hasCompletedRun,
    hasExitedRun,
    hasStartedRun,
    runStart,
  };
}

function processConfiguredRequirementEvent({
  configuration,
  event,
  requirementProcessor,
  transition,
}: {
  readonly configuration: CompiledConfiguration;
  readonly event: FellowshipEvent;
  readonly requirementProcessor: RequirementProcessorState;
  readonly transition: ConfiguredDungeonRunTransition;
}): ProcessRequirementEventResult {
  const state = transition.hasStartedRun
    ? initialRequirementProcessorState
    : requirementProcessor;

  if (
    transition.runStart === undefined ||
    !doesDungeonRunStartMatchConfiguration({
      configuration,
      runStart: transition.runStart,
    })
  ) {
    return {
      completedMilestones: [],
      observation: undefined,
      satisfiedRequirements: [],
      state,
    };
  }

  return processRequirementEvent({
    configuration,
    event,
    runStart: transition.runStart,
    state,
  });
}

function getNextConfiguredDungeonRunState({
  currentState,
  timestamp,
  trackerResult,
  transition,
}: {
  readonly currentState: ConfiguredDungeonRunState | undefined;
  readonly timestamp: DateTime.Utc;
  readonly trackerResult: DungeonRunTrackerResult;
  readonly transition: ConfiguredDungeonRunTransition;
}): ConfiguredDungeonRunState | undefined {
  if (transition.hasStartedRun && trackerResult.startedRun !== undefined) {
    return {
      startedAt: trackerResult.startedRun.startedAt,
      status: "ACTIVE",
    };
  }

  if (transition.hasCompletedRun && trackerResult.completedRun !== undefined) {
    return {
      endedAt: timestamp,
      startedAt: trackerResult.completedRun.start.startedAt,
      status: "COMPLETED",
    };
  }

  if (transition.hasExitedRun && trackerResult.exitedRunStart !== undefined) {
    return {
      endedAt: timestamp,
      startedAt: trackerResult.exitedRunStart.startedAt,
      status: "EXITED",
    };
  }

  return currentState;
}

function getProcessingEvents({
  requirementResult,
  timestamp,
  transition,
}: {
  readonly requirementResult: ProcessRequirementEventResult;
  readonly timestamp: DateTime.Utc;
  readonly transition: ConfiguredDungeonRunTransition;
}): ReadonlyArray<DungeonRunProcessingEvent> {
  const runStartedEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    transition.hasStartedRun
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_STARTED,
          },
        ]
      : [];

  const requirementSatisfiedEvents = A.map(
    requirementResult.satisfiedRequirements,
    (satisfiedRequirement): DungeonRunProcessingEvent => {
      return {
        requirement: satisfiedRequirement,
        type: DUNGEON_RUN_PROCESSING_EVENT.REQUIREMENT_SATISFIED,
      };
    },
  );

  const milestoneCompletedEvents = A.map(
    requirementResult.completedMilestones,
    (completedMilestone): DungeonRunProcessingEvent => {
      return {
        milestone: completedMilestone,
        type: DUNGEON_RUN_PROCESSING_EVENT.MILESTONE_COMPLETED,
      };
    },
  );

  const runCompletedEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    transition.hasCompletedRun
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_COMPLETED,
          },
        ]
      : [];

  const runExitedEvents: ReadonlyArray<DungeonRunProcessingEvent> =
    transition.hasExitedRun
      ? [
          {
            timestamp,
            type: DUNGEON_RUN_PROCESSING_EVENT.RUN_EXITED,
          },
        ]
      : [];

  return [
    ...runStartedEvents,
    ...requirementSatisfiedEvents,
    ...milestoneCompletedEvents,
    ...runCompletedEvents,
    ...runExitedEvents,
  ];
}

export function processDungeonRunEvent({
  configuration,
  event,
  state,
}: ProcessDungeonRunEventOptions): ProcessDungeonRunEventResult {
  const trackerResult = trackDungeonRunEvent({
    event,
    state: state.runTracker,
  });

  const transition = getConfiguredDungeonRunTransition({
    configuration,
    previousRunStart: state.runTracker.currentStart,
    trackerResult,
  });

  const requirementResult = processConfiguredRequirementEvent({
    configuration,
    event,
    requirementProcessor: state.configuredRun.requirementProcessor,
    transition,
  });

  const timestamp = getEventTimestamp(event);

  return {
    observation: requirementResult.observation,
    processingEvents: getProcessingEvents({
      requirementResult,
      timestamp,
      transition,
    }),
    state: {
      configuredRun: {
        dungeonRun: getNextConfiguredDungeonRunState({
          currentState: state.configuredRun.dungeonRun,
          timestamp,
          trackerResult,
          transition,
        }),
        requirementProcessor: requirementResult.state,
      },
      runTracker: trackerResult.state,
    },
  };
}
