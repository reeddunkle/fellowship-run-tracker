import * as Schema from "effect/Schema";

import { ConfigurationLabelSchema } from "@frt/shared/configuration/configuration-label-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export const label = Schema.decodeSync(ConfigurationLabelSchema)(
  "Godfall Quarry Route",
);

export const configuration = {
  dungeonId: "25",
  dungeonLevel: 64,
  milestones: [
    {
      comparisonTime: null,
      label: "Task Masters",
      requirements: [
        {
          requiredCount: 3,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "243",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Ghorn the Avalanche",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "280",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Arcane Warden",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "248",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Titan pull",
      requirements: [
        {
          encounterId: "34",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_START",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Titan kill",
      requirements: [
        {
          encounterId: "34",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ENCOUNTER_END",
        },
      ],
    },
  ],
} satisfies FellowshipMilestoneConfiguration;
