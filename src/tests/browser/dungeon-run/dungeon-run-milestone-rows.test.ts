import { describe, expect, test } from "vitest";

import { createDungeonRunMilestoneRows } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { type DungeonRunObservationInterpretation } from "@/electron/renderer/stores/dungeon-run/dungeon-run-interpretation.ts";
import { MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES } from "@/tests/common/fixtures/configuration-fixtures.ts";

function makeObservation({
  bestElapsedMilliseconds,
  meanElapsedMilliseconds,
  medianElapsedMilliseconds,
  occurrence,
  targetId,
  timestampMilliseconds,
  type,
}: {
  readonly bestElapsedMilliseconds: number;
  readonly meanElapsedMilliseconds: number;
  readonly medianElapsedMilliseconds: number;
  readonly occurrence: number;
  readonly targetId: string;
  readonly timestampMilliseconds: number;
  readonly type: DungeonRunObservationInterpretation["observation"]["type"];
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
      targetId,
      timestampMilliseconds,
      type,
    },
    occurrence,
    previousObservation: undefined,
  };
}

describe("createDungeonRunMilestoneRows", () => {
  test("calculates elapsed and comparison times from the dungeon start", () => {
    const milestone = MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[0];

    if (milestone === undefined) {
      throw new Error("Expected a milestone fixture.");
    }

    const requirement = milestone.requirements[0];

    if (requirement === undefined) {
      throw new Error("Expected a requirement fixture.");
    }

    const startedAtMilliseconds = 1_000;

    const observations = [
      makeObservation({
        bestElapsedMilliseconds: 62_000,
        meanElapsedMilliseconds: 64_000,
        medianElapsedMilliseconds: 63_000,
        occurrence: requirement.startOccurrence,
        targetId: requirement.targetId,
        timestampMilliseconds: 66_000,
        type: requirement.type,
      }),
    ];

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations,
      startedAtMilliseconds,
    });

    expect(rows).toHaveLength(1);

    const row = rows[0];

    expect(row).toBeDefined();

    expect(row?.isCompleted).toBe(true);
    expect(row?.completedAtMilliseconds).toBe(66_000);
    expect(row?.elapsedMilliseconds).toBe(65_000);
    expect(row?.comparisonElapsedMilliseconds).toEqual({
      average: 64_000,
      best: 62_000,
      goal: milestone.comparisonTime ?? undefined,
      median: 63_000,
    });

    expect(
      row?.elapsedMilliseconds === undefined ||
        row.comparisonElapsedMilliseconds.best === undefined
        ? undefined
        : row.elapsedMilliseconds - row.comparisonElapsedMilliseconds.best,
    ).toBe(3_000);
  });

  test("includes average, best, and median comparison elapsed times", () => {
    const milestone = MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[0];

    if (milestone === undefined) {
      throw new Error("Expected a milestone fixture.");
    }

    const requirement = milestone.requirements[0];

    if (requirement === undefined) {
      throw new Error("Expected a requirement fixture.");
    }

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 62_000,
          meanElapsedMilliseconds: 64_000,
          medianElapsedMilliseconds: 63_000,
          occurrence: requirement.startOccurrence,
          targetId: requirement.targetId,
          timestampMilliseconds: 66_000,
          type: requirement.type,
        }),
      ],
      startedAtMilliseconds: 1_000,
    });

    expect(rows[0]?.comparisonElapsedMilliseconds).toEqual({
      average: 64_000,
      best: 62_000,
      goal: milestone.comparisonTime ?? undefined,
      median: 63_000,
    });
  });

  test("uses the milestone comparison time as the goal", () => {
    const milestone = MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[0];

    if (milestone === undefined) {
      throw new Error("Expected a milestone fixture.");
    }

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
    const milestone = MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[3];

    if (milestone === undefined) {
      throw new Error("Expected the combined milestone fixture.");
    }

    const firstRequirement = milestone.requirements[0];
    const secondRequirement = milestone.requirements[1];

    if (firstRequirement === undefined || secondRequirement === undefined) {
      throw new Error("Expected two requirement fixtures.");
    }

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 30_000,
          meanElapsedMilliseconds: 32_000,
          medianElapsedMilliseconds: 31_000,
          occurrence: firstRequirement.startOccurrence,
          targetId: firstRequirement.targetId,
          timestampMilliseconds: 35_000,
          type: firstRequirement.type,
        }),
        makeObservation({
          bestElapsedMilliseconds: 45_000,
          meanElapsedMilliseconds: 48_000,
          medianElapsedMilliseconds: 47_000,
          occurrence: secondRequirement.startOccurrence,
          targetId: secondRequirement.targetId,
          timestampMilliseconds: 50_000,
          type: secondRequirement.type,
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
    const milestone = MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[3];

    if (milestone === undefined) {
      throw new Error("Expected the combined milestone fixture.");
    }

    const firstRequirement = milestone.requirements[0];
    const secondRequirement = milestone.requirements[1];

    if (firstRequirement === undefined || secondRequirement === undefined) {
      throw new Error("Expected two requirement fixtures.");
    }

    const observations: ReadonlyArray<DungeonRunObservationInterpretation> = [
      makeObservation({
        bestElapsedMilliseconds: 30_000,
        meanElapsedMilliseconds: 32_000,
        medianElapsedMilliseconds: 31_000,
        occurrence: firstRequirement.startOccurrence,
        targetId: firstRequirement.targetId,
        timestampMilliseconds: 35_000,
        type: firstRequirement.type,
      }),
      {
        ...makeObservation({
          bestElapsedMilliseconds: 45_000,
          meanElapsedMilliseconds: 48_000,
          medianElapsedMilliseconds: 47_000,
          occurrence: secondRequirement.startOccurrence,
          targetId: secondRequirement.targetId,
          timestampMilliseconds: 50_000,
          type: secondRequirement.type,
        }),
        analytics: undefined,
      },
    ];

    const rows = createDungeonRunMilestoneRows({
      milestones: [milestone],
      observations,
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
    const firstMilestone =
      MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[0];
    const secondMilestone =
      MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.milestones[1];

    if (firstMilestone === undefined || secondMilestone === undefined) {
      throw new Error("Expected two milestone fixtures.");
    }

    const firstRequirement = firstMilestone.requirements[0];
    const secondRequirement = secondMilestone.requirements[0];

    if (firstRequirement === undefined || secondRequirement === undefined) {
      throw new Error("Expected requirement fixtures.");
    }

    const rows = createDungeonRunMilestoneRows({
      milestones: [firstMilestone, secondMilestone],
      observations: [
        makeObservation({
          bestElapsedMilliseconds: 20_000,
          meanElapsedMilliseconds: 22_000,
          medianElapsedMilliseconds: 21_000,
          occurrence: firstRequirement.startOccurrence,
          targetId: firstRequirement.targetId,
          timestampMilliseconds: 26_000,
          type: firstRequirement.type,
        }),
        makeObservation({
          bestElapsedMilliseconds: 40_000,
          meanElapsedMilliseconds: 43_000,
          medianElapsedMilliseconds: 42_000,
          occurrence: secondRequirement.startOccurrence,
          targetId: secondRequirement.targetId,
          timestampMilliseconds: 51_000,
          type: secondRequirement.type,
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
