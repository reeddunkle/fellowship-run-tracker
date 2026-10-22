import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export const configuration = {
  adventureDifficulty: "HARD",
  dungeonCategory: "ADVENTURE",
  dungeonId: "36",
  dungeonLevel: 1,
  milestones: [
    {
      comparisonTime: null,
      label: "Spear Centurion Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "346",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Scrofa Pull",
      requirements: [
        {
          encounterId: "40",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_START",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Scrofa Defeated",
      requirements: [
        {
          encounterId: "40",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_END",
        },
      ],
    },
  ],
} satisfies FellowshipMilestoneConfiguration;
