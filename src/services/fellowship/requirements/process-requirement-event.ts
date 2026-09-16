import * as A from "effect/Array";
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
  createDungeonRunObservation,
  type DungeonRunObservation,
} from "@/services/fellowship/requirements/create-dungeon-run-observation.ts";
import { type RequirementLookup } from "@/services/fellowship/requirements/requirement-lookup.ts";
import {
  addRequirementObservation,
  getRequirementObservationHistory,
  type RequirementProcessorState,
} from "@/services/fellowship/requirements/requirement-processor-state.ts";
import { type FellowshipRunMilestone } from "@/services/fellowship/types.ts";
import { type DungeonStartEvent } from "@/services/fellowship/validation/events/dungeon-start.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { getElapsedMilliseconds } from "@/util/get-elapsed-milliseconds.ts";

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
  const observation = createDungeonRunObservation(event);

  if (observation === undefined) {
    return {
      completedMilestones: [],
      observation: undefined,
      satisfiedRequirements: [],
      state,
    };
  }

  const lookup = {
    targetId: observation.targetId,
    type: observation.type,
  } satisfies RequirementLookup;

  const references = getRequirementReferences({
    configuration,
    lookup,
  });

  if (references.length === 0) {
    return {
      completedMilestones: [],
      observation,
      satisfiedRequirements: [],
      state,
    };
  }

  const observationHistory = getRequirementObservationHistory({
    lookup,
    state,
  });

  const occurrence = (observationHistory?.observations.length ?? 0) + 1;

  const previousAnalysis = analyzeMilestoneProgress({
    configuration,
    state,
  });

  const nextState = addRequirementObservation({
    lookup,
    state,
    timestamp: observation.timestamp,
  });

  const nextAnalysis = analyzeMilestoneProgress({
    configuration,
    state: nextState,
  });

  return {
    completedMilestones: getNewlyCompletedMilestones({
      nextMilestones: nextAnalysis.milestones,
      previousMilestones: previousAnalysis.milestones,
      runStart,
    }),
    observation,
    satisfiedRequirements: getSatisfiedRequirements({
      occurrence,
      references,
    }),
    state: nextState,
  };
}
