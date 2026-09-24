import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { ConfigurationDefinitionIdSchema } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import {
  type ConfigurationApiConfiguration,
  type SaveConfigurationApiRequest,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import { ConfigurationFingerprintSchema } from "@frt/shared/configuration/configuration-fingerprint-schema.ts";
import { ConfigurationIdSchema } from "@frt/shared/configuration/configuration-id-schema.ts";
import { ConfigurationLabelSchema } from "@frt/shared/configuration/configuration-label-schema.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export const MOCK_CONFIGURATION_DEFINITION_ID = Schema.decodeSync(
  ConfigurationDefinitionIdSchema,
)("0198d56c-0000-7abc-8def-1234567890ab");

export const MOCK_CONFIGURATION_ID = Schema.decodeSync(ConfigurationIdSchema)(
  "0198d56c-1234-7abc-8def-1234567890ab",
);

export const MOCK_UNKNOWN_CONFIGURATION_ID = Schema.decodeSync(
  ConfigurationIdSchema,
)("0198d56c-5678-7abc-8def-1234567890ab");

export const MOCK_CONFIGURATION_FINGERPRINT = Schema.decodeSync(
  ConfigurationFingerprintSchema,
)("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

export const MOCK_CONFIGURATION_LABEL = Schema.decodeSync(
  ConfigurationLabelSchema,
)("Everdawn Grove Route");

export const MOCK_UPDATED_CONFIGURATION_LABEL = Schema.decodeSync(
  ConfigurationLabelSchema,
)("Updated Everdawn Grove Route");

export const MOCK_DUNGEON_ID = "11";
export const MOCK_ALTERNATE_DUNGEON_ID = "7";
export const MOCK_DUNGEON_LEVEL = 63;

const MOCK_CONFIGURATION_CREATED_AT = DateTime.makeUnsafe(
  "2026-01-01T00:00:00.000Z",
);

const MOCK_CONFIGURATION_UPDATED_AT = DateTime.makeUnsafe(
  "2026-01-02T00:00:00.000Z",
);

export const MOCK_FELLOWSHIP_CONFIGURATION = {
  dungeonId: MOCK_DUNGEON_ID,
  dungeonLevel: MOCK_DUNGEON_LEVEL,
  milestones: [
    {
      comparisonTime: null,
      label: "First Desecrator",
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
      label: "Second Desecrator",
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
      label: "Combined Milestone",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          type: "UNIT_DEATH",
          unitTypeId: "40",
        },
        {
          abilityId: "634",
          requiredCount: 1,
          startOccurrence: 1,
          type: "ABILITY_ACTIVATED",
        },
      ],
    },
  ],
} satisfies FellowshipMilestoneConfiguration;

export const MOCK_CONFIGURATION = {
  createdAt: MOCK_CONFIGURATION_CREATED_AT,
  dungeonId: MOCK_DUNGEON_ID,
  dungeonLevel: MOCK_DUNGEON_LEVEL,
  fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
  id: MOCK_CONFIGURATION_ID,
  label: MOCK_CONFIGURATION_LABEL,
  milestones: [
    {
      comparisonTime: null,
      label: "Desecrator 1 Killed",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ],
    },
  ],
  updatedAt: MOCK_CONFIGURATION_UPDATED_AT,
} satisfies ConfigurationApiConfiguration;

export const MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES = {
  ...MOCK_CONFIGURATION,
  milestones: [
    {
      comparisonTime: null,
      label: "First Desecrator",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Second Desecrator",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 2,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Boss Pull",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          targetId: "30",
          type: "ENCOUNTER_START",
        },
      ],
    },
    {
      comparisonTime: null,
      label: "Combined Milestone",
      requirements: [
        {
          requiredCount: 1,
          startOccurrence: 1,
          targetId: "40",
          type: "UNIT_DEATH",
        },
        {
          requiredCount: 1,
          startOccurrence: 1,
          targetId: "634",
          type: "ABILITY_ACTIVATED",
        },
      ],
    },
  ],
} satisfies ConfigurationApiConfiguration;

export const MOCK_SAVE_CONFIGURATION_REQUEST = {
  configuration: {
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
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
    ],
  },
  label: MOCK_CONFIGURATION_LABEL,
} satisfies SaveConfigurationApiRequest;
