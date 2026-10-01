import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { runTest } from "@frt/api/tests/common/run-test.ts";
import { createConfigurationFingerprint } from "@frt/db/configurations/configuration-fingerprint.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

const firstDesecratorMilestone = {
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
} satisfies FellowshipMilestoneConfiguration["milestones"][number];

const secondDesecratorMilestone = {
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
} satisfies FellowshipMilestoneConfiguration["milestones"][number];

const configuration = {
  dungeonId: "11",
  dungeonLevel: 1,
  milestones: [firstDesecratorMilestone, secondDesecratorMilestone],
} satisfies FellowshipMilestoneConfiguration;

function createFingerprints(
  first: FellowshipMilestoneConfiguration,
  second: FellowshipMilestoneConfiguration,
) {
  return E.gen(function* () {
    return {
      first: yield* createConfigurationFingerprint(first),
      second: yield* createConfigurationFingerprint(second),
    };
  }).pipe(runTest);
}

describe("createConfigurationFingerprint", () => {
  describe("creates the same fingerprint", () => {
    async function expectSameFingerprint(
      firstConfiguration: FellowshipMilestoneConfiguration,
      secondConfiguration: FellowshipMilestoneConfiguration,
    ) {
      const { first, second } = await createFingerprints(
        firstConfiguration,
        secondConfiguration,
      );

      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.canonicalJson).toBe(first.canonicalJson);
    }

    test("when labels change", async () => {
      await expectSameFingerprint(configuration, {
        ...configuration,
        milestones: [
          {
            ...firstDesecratorMilestone,
            label: "A Different Label",
          },
          {
            ...secondDesecratorMilestone,
            label: "Another Different Label",
          },
        ],
      });
    });

    test("when milestone order changes", async () => {
      await expectSameFingerprint(configuration, {
        ...configuration,
        milestones: [secondDesecratorMilestone, firstDesecratorMilestone],
      });
    });

    test("when requirement order changes", async () => {
      const unitDeathRequirement = {
        requiredCount: 1,
        startOccurrence: 1,
        type: "UNIT_DEATH",
        unitTypeId: "42",
      } satisfies FellowshipMilestoneConfiguration["milestones"][number]["requirements"][number];

      const encounterStartRequirement = {
        encounterId: "30",
        requiredCount: 1,
        startOccurrence: 1,
        type: "ENCOUNTER_START",
      } satisfies FellowshipMilestoneConfiguration["milestones"][number]["requirements"][number];

      await expectSameFingerprint(
        {
          dungeonId: "11",
          dungeonLevel: 1,
          milestones: [
            {
              comparisonTime: null,
              label: "Combined Milestone",
              requirements: [unitDeathRequirement, encounterStartRequirement],
            },
          ],
        },
        {
          dungeonId: "11",
          dungeonLevel: 1,
          milestones: [
            {
              comparisonTime: null,
              label: "Combined Milestone",
              requirements: [encounterStartRequirement, unitDeathRequirement],
            },
          ],
        },
      );
    });
  });

  describe("creates a different fingerprint", () => {
    async function expectDifferentFingerprint(
      firstConfiguration: FellowshipMilestoneConfiguration,
      secondConfiguration: FellowshipMilestoneConfiguration,
    ) {
      const { first, second } = await createFingerprints(
        firstConfiguration,
        secondConfiguration,
      );

      expect(second.fingerprint).not.toBe(first.fingerprint);
      expect(second.canonicalJson).not.toBe(first.canonicalJson);
    }

    test("when requirement semantics change", async () => {
      await expectDifferentFingerprint(configuration, {
        ...configuration,
        milestones: [
          firstDesecratorMilestone,
          {
            ...secondDesecratorMilestone,
            requirements: [
              {
                requiredCount: 2,
                startOccurrence: 2,
                type: "UNIT_DEATH",
                unitTypeId: "42",
              },
            ],
          },
        ],
      });
    });

    test("for a different dungeon", async () => {
      await expectDifferentFingerprint(configuration, {
        ...configuration,
        dungeonId: "7",
      });
    });
  });
});
