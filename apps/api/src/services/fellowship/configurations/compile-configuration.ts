import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { DuplicateMilestoneRequirementsError } from "@frt/api/errors/duplicate-milestone-requirements-error.ts";
import {
  type CompiledConfiguration,
  type CompiledMilestoneDefinition,
  type CompiledRequirement,
  type FellowshipMilestoneConfiguration,
  type RequirementReference,
  type RequirementReferencesByTargetId,
  type RequirementsByEvent,
} from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { getRequirementLookup } from "@frt/shared/fellowship/requirements/requirement-lookup.ts";
import { type FellowshipRequirement } from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";
import { type RequirementEventType } from "@frt/shared/fellowship/validation/requirement-event-type-schema.ts";
import { type RequirementObservationIdentity } from "@frt/shared/validation/common/requirement-observation-identity-schema.ts";

type CompiledConfigurationIndexes = {
  readonly milestonesById: HashMap.HashMap<string, CompiledMilestoneDefinition>;
  readonly requirementsByEvent: RequirementsByEvent;
};

type RequirementIdentity = readonly [
  ...RequirementObservationIdentity,
  startOccurrence: CompiledRequirement["startOccurrence"],
  requiredCount: CompiledRequirement["requiredCount"],
];

const RequirementIdentityOrder = Order.Tuple([
  Order.String,
  Order.String,
  Order.Number,
  Order.Number,
]);

function compileRequirement({
  configuration,
  requirement,
}: {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly requirement: FellowshipRequirement;
}): CompiledRequirement {
  const lookup = getRequirementLookup({
    dungeonId: configuration.dungeonId,
    requirement,
  });

  return {
    requiredCount: requirement.requiredCount,
    startOccurrence: requirement.startOccurrence,
    targetId: lookup.targetId,
    type: lookup.type,
  };
}

function getRequirementIdentity(
  requirement: CompiledRequirement,
): RequirementIdentity {
  return [
    requirement.type,
    requirement.targetId,
    requirement.startOccurrence,
    requirement.requiredCount,
  ];
}

function getMilestoneId(
  requirements: ReadonlyArray<CompiledRequirement>,
): string {
  const requirementIdentities = A.map(requirements, getRequirementIdentity);

  const sortedRequirementIdentities = A.sort(
    requirementIdentities,
    RequirementIdentityOrder,
  );

  return JSON.stringify(sortedRequirementIdentities);
}

function compileMilestones(
  configuration: FellowshipMilestoneConfiguration,
): ReadonlyArray<CompiledMilestoneDefinition> {
  return A.map(configuration.milestones, (definition) => {
    const requirements = A.map(definition.requirements, (requirement) => {
      return compileRequirement({
        configuration,
        requirement,
      });
    });

    return {
      ...definition,
      milestoneId: getMilestoneId(requirements),
      requirements,
    };
  });
}

type MilestoneIdentityOccurrence = {
  readonly index: number;
  readonly milestone: CompiledMilestoneDefinition;
};

function validateUniqueMilestones(
  milestones: ReadonlyArray<CompiledMilestoneDefinition>,
): E.Effect<void, DuplicateMilestoneRequirementsError> {
  return E.gen(function* () {
    const milestonesById = new Map<string, MilestoneIdentityOccurrence>();

    for (const [index, milestone] of milestones.entries()) {
      const existing = milestonesById.get(milestone.milestoneId);

      if (existing !== undefined) {
        return yield* new DuplicateMilestoneRequirementsError({
          duplicate: {
            index,
            label: milestone.label,
            requirements: milestone.requirements,
          },
          milestoneId: milestone.milestoneId,
          original: {
            index: existing.index,
            label: existing.milestone.label,
            requirements: existing.milestone.requirements,
          },
        });
      }

      milestonesById.set(milestone.milestoneId, {
        index,
        milestone,
      });
    }
  });
}

function addRequirementReference({
  definition,
  requirement,
  requirementsByEvent,
}: {
  readonly definition: CompiledMilestoneDefinition;
  readonly requirement: CompiledRequirement;
  readonly requirementsByEvent: RequirementsByEvent;
}): RequirementsByEvent {
  const referencesByTargetId = Option.getOrElse(
    HashMap.get(requirementsByEvent, requirement.type),
    () => HashMap.empty(),
  );

  const references = Option.getOrElse(
    HashMap.get(referencesByTargetId, requirement.targetId),
    () => [] as ReadonlyArray<RequirementReference>,
  );

  const nextReferences = A.append(references, {
    milestoneId: definition.milestoneId,
    requiredCount: requirement.requiredCount,
    startOccurrence: requirement.startOccurrence,
  });

  const nextReferencesByTargetId = HashMap.set(
    referencesByTargetId,
    requirement.targetId,
    nextReferences,
  );

  return HashMap.set(
    requirementsByEvent,
    requirement.type,
    nextReferencesByTargetId,
  );
}

function createIndexes(
  milestones: ReadonlyArray<CompiledMilestoneDefinition>,
): CompiledConfigurationIndexes {
  return A.reduce(
    milestones,
    {
      milestonesById: HashMap.empty<string, CompiledMilestoneDefinition>(),
      requirementsByEvent: HashMap.empty<
        RequirementEventType,
        RequirementReferencesByTargetId
      >(),
    },
    (accumulator, definition) => {
      return {
        milestonesById: HashMap.set(
          accumulator.milestonesById,
          definition.milestoneId,
          definition,
        ),
        requirementsByEvent: A.reduce(
          definition.requirements,
          accumulator.requirementsByEvent,
          (requirementsByEvent, requirement) => {
            return addRequirementReference({
              definition,
              requirement,
              requirementsByEvent,
            });
          },
        ),
      };
    },
  );
}

export function compileConfiguration(
  configuration: FellowshipMilestoneConfiguration,
): E.Effect<CompiledConfiguration, DuplicateMilestoneRequirementsError> {
  return E.gen(function* () {
    const milestones = compileMilestones(configuration);

    yield* validateUniqueMilestones(milestones);

    const { milestonesById, requirementsByEvent } = createIndexes(milestones);

    return {
      dungeonId: configuration.dungeonId,
      dungeonLevel: configuration.dungeonLevel,
      milestones,
      milestonesById,
      requirementsByEvent,
    };
  });
}
