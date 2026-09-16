import * as A from "effect/Array";
import * as Match from "effect/Match";

import {
  type ConfigurationEditorValue,
  type DecodedConfigurationEditorValue,
} from "@/electron/renderer/components/configuration/configuration-form-schema.ts";
import {
  type ConfigurationApiConfiguration,
  type SaveConfigurationApiRequest,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { FELLOWSHIP_EVENT } from "@/services/fellowship/constants/fellowship-event.ts";
import { type FellowshipRequirement } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";
import { formatComparisonTime } from "@/validation/milestone/comparison-time-form-schema.ts";

function createEditorRequirement(
  requirement: ConfigurationApiConfiguration["milestones"][number]["requirements"][number],
) {
  return {
    // @effect-diagnostics-next-line cryptoRandomUUID:off
    id: crypto.randomUUID(),
    requiredCount: String(requirement.requiredCount),
    startOccurrence: String(requirement.startOccurrence),
    targetId: requirement.targetId,
    type: requirement.type,
  };
}

export function createConfigurationEditorValue(
  configuration: ConfigurationApiConfiguration,
): ConfigurationEditorValue {
  return {
    dungeonId: configuration.dungeonId,
    dungeonLevel: String(configuration.dungeonLevel),
    label: configuration.label,
    milestones: configuration.milestones.map((milestone) => {
      return {
        comparisonTime: formatComparisonTime(milestone.comparisonTime),
        // @effect-diagnostics-next-line cryptoRandomUUID:off
        id: crypto.randomUUID(),
        label: milestone.label,
        requirements: milestone.requirements.map(createEditorRequirement),
      };
    }),
  };
}

function createMilestoneRequirement(
  requirement: DecodedConfigurationEditorValue["milestones"][number]["requirements"][number],
): FellowshipRequirement {
  const occurrence = {
    requiredCount: requirement.requiredCount,
    startOccurrence: requirement.startOccurrence,
  };

  return Match.value(requirement).pipe(
    Match.when(
      { type: FELLOWSHIP_EVENT.ABILITY_ACTIVATED },
      (matchedRequirement) => {
        return {
          abilityId: matchedRequirement.targetId,
          ...occurrence,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.whenOr(
      { type: FELLOWSHIP_EVENT.DUNGEON_START },
      { type: FELLOWSHIP_EVENT.DUNGEON_END },
      (matchedRequirement) => {
        return {
          ...occurrence,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.whenOr(
      { type: FELLOWSHIP_EVENT.ENCOUNTER_START },
      { type: FELLOWSHIP_EVENT.ENCOUNTER_END },
      (matchedRequirement) => {
        return {
          encounterId: matchedRequirement.targetId,
          ...occurrence,
          type: matchedRequirement.type,
        };
      },
    ),
    Match.when({ type: FELLOWSHIP_EVENT.UNIT_DEATH }, (matchedRequirement) => {
      return {
        ...occurrence,
        type: matchedRequirement.type,
        unitTypeId: matchedRequirement.targetId,
      };
    }),
    Match.exhaustive,
  );
}

export function saveConfigurationApiRequest(
  value: DecodedConfigurationEditorValue,
): SaveConfigurationApiRequest {
  return {
    configuration: {
      dungeonId: value.dungeonId,
      dungeonLevel: value.dungeonLevel,
      milestones: value.milestones.map((milestone) => {
        return {
          comparisonTime: milestone.comparisonTime,
          label: milestone.label,
          requirements: A.map(
            milestone.requirements,
            createMilestoneRequirement,
          ),
        };
      }),
    },
    label: value.label,
  };
}
