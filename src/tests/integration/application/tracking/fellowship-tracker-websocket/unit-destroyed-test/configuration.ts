import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";

export const configuration = {
  dungeonId: "6", // Empyrean sands
  dungeonLevel: 65,
  milestones: [
    {
      comparisonTime: null,
      label: "Greedspawn 1",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "115",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Greedspawn 2",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 2,
          type: "UNIT_DEATH",
          unitTypeId: "115",
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
          encounterId: "31",
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
          encounterId: "31",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_END",
        },
      ],
    },
  ],
} satisfies FellowshipMilestoneConfiguration;
