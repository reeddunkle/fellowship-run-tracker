import * as A from "effect/Array";

import { type PersistedConfiguration } from "@frt/db/daos/configuration/configuration-dao.ts";
import {
  type ConfigurationApiConfiguration,
  type ConfigurationApiMilestone,
  type ConfigurationApiRequirement,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { getRequirementLookup } from "@frt/shared/fellowship/requirements/requirement-lookup.ts";
import { type FellowshipRequirement } from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";

function createConfigurationApiRequirement({
  dungeonId,
  requirement,
}: {
  readonly dungeonId: string;
  readonly requirement: FellowshipRequirement;
}): ConfigurationApiRequirement {
  const lookup = getRequirementLookup({
    dungeonId,
    requirement,
  });

  return {
    requiredCount: requirement.requiredCount,
    startOccurrence: requirement.startOccurrence,
    targetId: lookup.targetId,
    type: lookup.type,
  };
}

function createConfigurationApiMilestone({
  dungeonId,
  milestone,
}: {
  readonly dungeonId: string;
  readonly milestone: FellowshipMilestoneConfiguration["milestones"][number];
}): ConfigurationApiMilestone {
  return {
    comparisonTime: milestone.comparisonTime,
    label: milestone.label,
    requirements: A.map(milestone.requirements, (requirement) => {
      return createConfigurationApiRequirement({
        dungeonId,
        requirement,
      });
    }),
  };
}

export function createConfigurationApiResponse({
  configuration,
  createdAt,
  fingerprint,
  id,
  label,
  updatedAt,
}: PersistedConfiguration): ConfigurationApiConfiguration {
  return {
    createdAt,
    dungeonId: configuration.dungeonId,
    dungeonLevel: configuration.dungeonLevel,
    fingerprint,
    id,
    label,
    milestones: A.map(configuration.milestones, (milestone) => {
      return createConfigurationApiMilestone({
        dungeonId: configuration.dungeonId,
        milestone,
      });
    }),
    updatedAt,
  };
}
