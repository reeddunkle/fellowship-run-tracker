import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { createConfigurationFingerprint } from "@/application/configurations/configuration-fingerprint.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { runTest } from "@/tests/common/run-test.ts";

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

describe("createConfigurationFingerprint", () => {
  test("creates the same fingerprint when labels change", async () => {
    const renamedConfiguration = {
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
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const first = yield* createConfigurationFingerprint(configuration);

      const second =
        yield* createConfigurationFingerprint(renamedConfiguration);

      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.canonicalJson).toBe(first.canonicalJson);
    });

    await runTest(program);
  });

  test("creates the same fingerprint when milestone order changes", async () => {
    const reorderedConfiguration = {
      ...configuration,
      milestones: [secondDesecratorMilestone, firstDesecratorMilestone],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const first = yield* createConfigurationFingerprint(configuration);

      const second = yield* createConfigurationFingerprint(
        reorderedConfiguration,
      );

      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.canonicalJson).toBe(first.canonicalJson);
    });

    await runTest(program);
  });

  test("creates the same fingerprint when requirement order changes", async () => {
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

    const configurationWithMultipleRequirements = {
      dungeonId: "11",
      dungeonLevel: 1,
      milestones: [
        {
          comparisonTime: null,
          label: "Combined Milestone",
          requirements: [unitDeathRequirement, encounterStartRequirement],
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const reorderedConfiguration = {
      dungeonId: "11",
      dungeonLevel: 1,
      milestones: [
        {
          comparisonTime: null,
          label: "Combined Milestone",
          requirements: [encounterStartRequirement, unitDeathRequirement],
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const first = yield* createConfigurationFingerprint(
        configurationWithMultipleRequirements,
      );

      const second = yield* createConfigurationFingerprint(
        reorderedConfiguration,
      );

      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.canonicalJson).toBe(first.canonicalJson);
    });

    await runTest(program);
  });

  test("creates a different fingerprint when requirement semantics change", async () => {
    const changedConfiguration = {
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
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const first = yield* createConfigurationFingerprint(configuration);

      const second =
        yield* createConfigurationFingerprint(changedConfiguration);

      expect(second.fingerprint).not.toBe(first.fingerprint);
      expect(second.canonicalJson).not.toBe(first.canonicalJson);
    });

    await runTest(program);
  });

  test("creates a different fingerprint for a different dungeon", async () => {
    const changedConfiguration = {
      ...configuration,
      dungeonId: "7",
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const first = yield* createConfigurationFingerprint(configuration);

      const second =
        yield* createConfigurationFingerprint(changedConfiguration);

      expect(second.fingerprint).not.toBe(first.fingerprint);
    });

    await runTest(program);
  });
});
