import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import {
  analyzeMilestoneProgress,
  type MilestoneProgress,
} from "@/services/fellowship/configurations/analyze-milestone-progress.ts";
import {
  type CompiledConfiguration,
  type RequirementReference,
} from "@/services/fellowship/configurations/configuration-types.ts";
import {
  getRequirementLookupForEvent,
  type RequirementLookup,
} from "@/services/fellowship/requirements/requirement-lookup.ts";
import {
  type RequirementObservationHistory,
  type RequirementObservationsByTargetId,
  type RequirementProcessorState,
} from "@/services/fellowship/requirements/requirement-processor-state.ts";
import { type FellowshipRunMilestone } from "@/services/fellowship/types.ts";
import { type DungeonStartEvent } from "@/services/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { getElapsedMilliseconds } from "@/util/get-elapsed-milliseconds.ts";

export type DungeonRunObservation = {
  readonly targetId: RequirementLookup["targetId"];
  readonly timestamp: DateTime.Utc;
  readonly type: RequirementEventType;
};

export type SatisfiedRequirement = RequirementReference;

export type ProcessRequirementEventOptions = {
  readonly configuration: CompiledConfiguration;
  readonly event: FellowshipEvent;
  readonly runStart: DungeonStartEvent;
  readonly state: RequirementProcessorState;
};

export type ProcessRequirementEventResult = {
  readonly completedMilestones: ReadonlyArray<FellowshipRunMilestone>;
  readonly observation: DungeonRunObservation | undefined;
  readonly satisfiedRequirements: ReadonlyArray<SatisfiedRequirement>;
  readonly state: RequirementProcessorState;
};

function getEventTimestamp(event: FellowshipEvent): DateTime.Utc {
  return event.type === "DUNGEON_START" ? event.startedAt : event.timestamp;
}

function getRequirementReferences({
  configuration,
  lookup,
}: {
  readonly configuration: CompiledConfiguration;
  readonly lookup: RequirementLookup;
}): ReadonlyArray<RequirementReference> {
  return Option.flatMap(
    HashMap.get(configuration.requirementsByEvent, lookup.type),
    (referencesByTargetId) => {
      return HashMap.get(referencesByTargetId, lookup.targetId);
    },
  ).pipe(Option.getOrElse(() => []));
}

function getObservationHistory({
  lookup,
  state,
}: {
  readonly lookup: RequirementLookup;
  readonly state: RequirementProcessorState;
}): RequirementObservationHistory | undefined {
  return Option.flatMap(
    HashMap.get(state.requirementObservations, lookup.type),
    (observationsByTargetId) => {
      return HashMap.get(observationsByTargetId, lookup.targetId);
    },
  ).pipe(Option.getOrUndefined);
}

function addRequirementObservation({
  lookup,
  state,
  timestamp,
}: {
  readonly lookup: RequirementLookup;
  readonly state: RequirementProcessorState;
  readonly timestamp: DateTime.Utc;
}): RequirementProcessorState {
  const observationsByTargetId: RequirementObservationsByTargetId =
    Option.getOrElse(
      HashMap.get(state.requirementObservations, lookup.type),
      () => HashMap.empty(),
    );

  const observationHistory = Option.getOrElse(
    HashMap.get(observationsByTargetId, lookup.targetId),
    () => {
      return {
        observations: [],
      } satisfies RequirementObservationHistory;
    },
  );

  const nextObservationHistory = {
    observations: A.append(observationHistory.observations, {
      timestamp,
    }),
  } satisfies RequirementObservationHistory;

  const nextObservationsByTargetId = HashMap.set(
    observationsByTargetId,
    lookup.targetId,
    nextObservationHistory,
  );

  return {
    requirementObservations: HashMap.set(
      state.requirementObservations,
      lookup.type,
      nextObservationsByTargetId,
    ),
  };
}

function getSatisfiedRequirements({
  occurrence,
  references,
}: {
  readonly occurrence: number;
  readonly references: ReadonlyArray<RequirementReference>;
}): ReadonlyArray<SatisfiedRequirement> {
  return A.filter(references, (reference) => {
    const requiredEndOccurrence =
      reference.startOccurrence + reference.requiredCount - 1;

    return occurrence === requiredEndOccurrence;
  });
}

function createRunMilestone({
  progress,
  runStart,
}: {
  readonly progress: MilestoneProgress;
  readonly runStart: DungeonStartEvent;
}): FellowshipRunMilestone | undefined {
  const timestamp = progress.completedAt;

  if (timestamp === undefined) {
    return undefined;
  }

  return {
    elapsedMilliseconds: getElapsedMilliseconds(runStart.startedAt, timestamp),
    label: progress.definition.label,
    milestoneId: progress.definition.milestoneId,
    timestamp,
  };
}

function getNewlyCompletedMilestones({
  nextMilestones,
  previousMilestones,
  runStart,
}: {
  readonly nextMilestones: ReadonlyArray<MilestoneProgress>;
  readonly previousMilestones: ReadonlyArray<MilestoneProgress>;
  readonly runStart: DungeonStartEvent;
}): ReadonlyArray<FellowshipRunMilestone> {
  return A.flatMap(nextMilestones, (nextMilestone) => {
    if (!nextMilestone.isComplete) {
      return [];
    }

    const previousMilestone = A.findFirst(
      previousMilestones,
      (candidateMilestone) => {
        return (
          candidateMilestone.definition.milestoneId ===
          nextMilestone.definition.milestoneId
        );
      },
    );

    if (
      Option.isSome(previousMilestone) &&
      previousMilestone.value.isComplete
    ) {
      return [];
    }

    const milestone = createRunMilestone({
      progress: nextMilestone,
      runStart,
    });

    return milestone === undefined ? [] : [milestone];
  });
}

export function processRequirementEvent({
  configuration,
  event,
  runStart,
  state,
}: ProcessRequirementEventOptions): ProcessRequirementEventResult {
  const emptyResult: ProcessRequirementEventResult = {
    completedMilestones: [],
    observation: undefined,
    satisfiedRequirements: [],
    state,
  };

  const lookup = getRequirementLookupForEvent(event);

  if (lookup === undefined) {
    return emptyResult;
  }

  const references = getRequirementReferences({
    configuration,
    lookup,
  });

  if (references.length === 0) {
    return emptyResult;
  }

  const observationHistory = getObservationHistory({
    lookup,
    state,
  });

  const currentOccurrence = (observationHistory?.observations.length ?? 0) + 1;

  const timestamp = getEventTimestamp(event);

  const observation = {
    targetId: lookup.targetId,
    timestamp,
    type: lookup.type,
  } satisfies DungeonRunObservation;

  const previousAnalysis = analyzeMilestoneProgress({
    configuration,
    state,
  });

  const nextState = addRequirementObservation({
    lookup,
    state,
    timestamp,
  });

  const nextAnalysis = analyzeMilestoneProgress({
    configuration,
    state: nextState,
  });

  const satisfiedRequirements = getSatisfiedRequirements({
    occurrence: currentOccurrence,
    references,
  });

  const completedMilestones = getNewlyCompletedMilestones({
    nextMilestones: nextAnalysis.milestones,
    previousMilestones: previousAnalysis.milestones,
    runStart,
  });

  return {
    completedMilestones,
    observation,
    satisfiedRequirements,
    state: nextState,
  };
}
