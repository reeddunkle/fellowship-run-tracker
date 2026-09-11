import type * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import {
  type CompiledConfiguration,
  type CompiledMilestoneDefinition,
  type CompiledRequirement,
} from "@/services/fellowship/configurations/configuration-types.ts";
import {
  type RequirementObservation,
  type RequirementObservationHistory,
  type RequirementProcessorState,
} from "@/services/fellowship/requirements/requirement-processor-state.ts";

type RequirementProgress = {
  readonly completedAt: DateTime.Utc | undefined;
  readonly isComplete: boolean;
  readonly observations: ReadonlyArray<RequirementObservation>;
  readonly requirement: CompiledRequirement;
};

export type MilestoneProgress = {
  readonly completedAt: DateTime.Utc | undefined;
  readonly definition: CompiledMilestoneDefinition;
  readonly isComplete: boolean;
  readonly requirements: ReadonlyArray<RequirementProgress>;
};

export type RunAnalysis = {
  readonly milestones: ReadonlyArray<MilestoneProgress>;
};

function getRequirementObservationHistory({
  requirement,
  state,
}: {
  readonly requirement: CompiledRequirement;
  readonly state: RequirementProcessorState;
}): RequirementObservationHistory | undefined {
  return Option.flatMap(
    HashMap.get(state.requirementObservations, requirement.type),
    (observationsByTargetId) => {
      return HashMap.get(observationsByTargetId, requirement.targetId);
    },
  ).pipe(Option.getOrUndefined);
}

function analyzeRequirementProgress({
  requirement,
  state,
}: {
  readonly requirement: CompiledRequirement;
  readonly state: RequirementProcessorState;
}): RequirementProgress {
  const observationHistory = getRequirementObservationHistory({
    requirement,
    state,
  });

  const startIndex = requirement.startOccurrence - 1;
  const endIndex = startIndex + requirement.requiredCount;

  const observations =
    observationHistory?.observations.slice(startIndex, endIndex) ?? [];

  const isComplete = observations.length === requirement.requiredCount;

  return {
    completedAt: isComplete ? observations.at(-1)?.timestamp : undefined,
    isComplete,
    observations,
    requirement,
  };
}

function getMilestoneCompletedAt(
  requirements: ReadonlyArray<RequirementProgress>,
): DateTime.Utc | undefined {
  if (
    requirements.length === 0 ||
    requirements.some((requirement) => {
      return !requirement.isComplete;
    })
  ) {
    return undefined;
  }

  return requirements.reduce<DateTime.Utc | undefined>(
    (latestTimestamp, requirement) => {
      const completedAt = requirement.completedAt;

      if (completedAt === undefined) {
        return latestTimestamp;
      }

      if (
        latestTimestamp === undefined ||
        completedAt.epochMilliseconds > latestTimestamp.epochMilliseconds
      ) {
        return completedAt;
      }

      return latestTimestamp;
    },
    undefined,
  );
}

function analyzeMilestoneDefinition({
  definition,
  state,
}: {
  readonly definition: CompiledMilestoneDefinition;
  readonly state: RequirementProcessorState;
}): MilestoneProgress {
  const requirements = definition.requirements.map((requirement) => {
    return analyzeRequirementProgress({
      requirement,
      state,
    });
  });

  const completedAt = getMilestoneCompletedAt(requirements);

  return {
    completedAt,
    definition,
    isComplete: completedAt !== undefined,
    requirements,
  };
}

export function analyzeMilestoneProgress({
  configuration,
  state,
}: {
  readonly configuration: CompiledConfiguration;
  readonly state: RequirementProcessorState;
}): RunAnalysis {
  const milestones = configuration.milestones.flatMap((milestone) => {
    const definition = Option.getOrUndefined(
      HashMap.get(configuration.milestonesById, milestone.milestoneId),
    );

    if (definition === undefined) {
      return [];
    }

    return [
      analyzeMilestoneDefinition({
        definition,
        state,
      }),
    ];
  });

  return {
    milestones,
  };
}
