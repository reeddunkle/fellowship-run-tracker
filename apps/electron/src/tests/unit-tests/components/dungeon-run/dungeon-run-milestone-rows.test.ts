import { describe, expect, test } from "vitest";

import { MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

import { createDungeonRunMilestoneRows } from "@/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunObservationInterpretation } from "@/renderer/stores/dungeon-run/dungeon-run-interpretation.ts";

type Milestone =
  (typeof MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES)["milestones"][number];

function getMilestone(index: number): Milestone {
  const milestone =
    MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[index];

  if (milestone === undefined) {
    throw new Error(`Expected a milestone fixture at index ${index}.`);
  }

  return milestone;
}

function getRequirement(
  milestone: Milestone,
  index: number,
): Milestone["requirements"][number] {
  const requirement = milestone.requirements[index];

  if (requirement === undefined) {
    throw new Error(`Expected a requirement fixture at index ${index}.`);
  }

  return requirement;
}

function makeObservation({
  bestElapsedMilliseconds,
  meanElapsedMilliseconds,
  medianElapsedMilliseconds,
  requirement,
  timestampMilliseconds,
}: {
  readonly bestElapsedMilliseconds: number;
  readonly meanElapsedMilliseconds: number;
  readonly medianElapsedMilliseconds: number;
  readonly requirement: Milestone["requirements"][number];
  readonly timestampMilliseconds: number;
}): DungeonRunObservationInterpretation {
  return {
    analytics: {
      bestElapsedMilliseconds,
      meanElapsedMilliseconds,
      medianElapsedMilliseconds,
      sampleCount: 10,
    },
    elapsedFromPreviousObservationMilliseconds: undefined,
    elapsedFromStartMilliseconds: undefined,
    observation: {
      targetId: requirement.targetId,
      timestampMilliseconds,
      type: requirement.type,
    },
    occurrence: requirement.startOccurrence,
    previousObservation: undefined,
  };
}

describe("createDungeonRunMilestoneRows", () => {
  test("calculates elapsed and comparison times from the dungeon start", () => {
    const milestone = getMilestone(0);

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 62_000,
          meanElapsedMilliseconds: 64_000,
          medianElapsedMilliseconds: 63_000,
          requirement: getRequirement(milestone, 0),
          timestampMilliseconds: 66_000,
        }),
      ],
      startedAtMilliseconds: 1_000,
    });

    expect(rows).toHaveLength(1);

    const row = rows[0];

    expect(row?.isCompleted).toBe(true);
    expect(row?.completedAtMilliseconds).toBe(66_000);
    expect(row?.elapsedMilliseconds).toBe(65_000);
    expect(row?.comparisonElapsedMilliseconds).toEqual({
      average: 64_000,
      best: 62_000,
      goal: milestone.comparisonTime ?? undefined,
      median: 63_000,
    });
  });

  test("uses the milestone comparison time as the goal", () => {
    const milestone = getMilestone(0);

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [],
      startedAtMilliseconds: 1_000,
    });

    expect(rows[0]?.comparisonElapsedMilliseconds.goal).toBe(
      milestone.comparisonTime ?? undefined,
    );
  });

  test("uses the latest requirement completion for milestone comparison times", () => {
    const milestone = getMilestone(3);

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 30_000,
          meanElapsedMilliseconds: 32_000,
          medianElapsedMilliseconds: 31_000,
          requirement: getRequirement(milestone, 0),
          timestampMilliseconds: 35_000,
        }),
        makeObservation({
          bestElapsedMilliseconds: 45_000,
          meanElapsedMilliseconds: 48_000,
          medianElapsedMilliseconds: 47_000,
          requirement: getRequirement(milestone, 1),
          timestampMilliseconds: 50_000,
        }),
      ],
      startedAtMilliseconds: 1_000,
    });

    const row = rows[0];

    expect(row?.isCompleted).toBe(true);
    expect(row?.completedAtMilliseconds).toBe(50_000);
    expect(row?.elapsedMilliseconds).toBe(49_000);
    expect(row?.comparisonElapsedMilliseconds).toEqual({
      average: 48_000,
      best: 45_000,
      goal: milestone.comparisonTime ?? undefined,
      median: 47_000,
    });
  });

  test("does not produce history comparisons when a completed requirement has no matching history", () => {
    const milestone = getMilestone(3);

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 30_000,
          meanElapsedMilliseconds: 32_000,
          medianElapsedMilliseconds: 31_000,
          requirement: getRequirement(milestone, 0),
          timestampMilliseconds: 35_000,
        }),
        {
          ...makeObservation({
            bestElapsedMilliseconds: 45_000,
            meanElapsedMilliseconds: 48_000,
            medianElapsedMilliseconds: 47_000,
            requirement: getRequirement(milestone, 1),
            timestampMilliseconds: 50_000,
          }),
          analytics: undefined,
        },
      ],
      startedAtMilliseconds: 1_000,
    });

    const row = rows[0];

    expect(row?.isCompleted).toBe(true);
    expect(row?.elapsedMilliseconds).toBe(49_000);
    expect(row?.comparisonElapsedMilliseconds).toEqual({
      average: undefined,
      best: undefined,
      goal: milestone.comparisonTime ?? undefined,
      median: undefined,
    });
  });

  test("calculates segment elapsed time from the previous completed milestone", () => {
    const firstMilestone = getMilestone(0);
    const secondMilestone = getMilestone(1);

    const rows = createDungeonRunMilestoneRows({
      milestones: [firstMilestone, secondMilestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 20_000,
          meanElapsedMilliseconds: 22_000,
          medianElapsedMilliseconds: 21_000,
          requirement: getRequirement(firstMilestone, 0),
          timestampMilliseconds: 26_000,
        }),
        makeObservation({
          bestElapsedMilliseconds: 40_000,
          meanElapsedMilliseconds: 43_000,
          medianElapsedMilliseconds: 42_000,
          requirement: getRequirement(secondMilestone, 0),
          timestampMilliseconds: 51_000,
        }),
      ],
      startedAtMilliseconds: 1_000,
    });

    expect(rows).toHaveLength(2);

    expect(rows[0]?.elapsedMilliseconds).toBe(25_000);
    expect(rows[0]?.segmentStartedAtMilliseconds).toBe(1_000);
    expect(rows[0]?.segmentElapsedMilliseconds).toBe(25_000);

    expect(rows[1]?.elapsedMilliseconds).toBe(50_000);
    expect(rows[1]?.segmentStartedAtMilliseconds).toBe(26_000);
    expect(rows[1]?.segmentElapsedMilliseconds).toBe(25_000);
  });
});
