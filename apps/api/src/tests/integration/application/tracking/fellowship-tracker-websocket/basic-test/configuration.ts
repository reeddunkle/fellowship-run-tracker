import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export const configuration = {
  dungeonId: "11",
  dungeonLevel: 64,
  milestones: [
    {
      comparisonTime: null,
      label: "Desecrator 1 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "42",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Butcher 1 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "41",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Desecrator 2 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 2,
          type: "UNIT_DEATH",
          unitTypeId: "42",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Seer 1 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "40",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Butcher 2 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 2,
          type: "UNIT_DEATH",
          unitTypeId: "41",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Shadowlord 1 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "274",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Shadowlord 2 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 2,
          type: "UNIT_DEATH",
          unitTypeId: "274",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Boss Pull",
      requirements: [
        {
          encounterId: "30",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_START",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Boss Kill",
      requirements: [
        {
          encounterId: "30",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_END",
        },
      ],
    },
  ],
} satisfies FellowshipMilestoneConfiguration;
