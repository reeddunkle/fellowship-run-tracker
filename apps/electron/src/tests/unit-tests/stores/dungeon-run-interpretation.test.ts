import { describe, expect, test } from "vitest";

import { MOCK_DUNGEON_RUN_STATE_API } from "@frt/api/tests/common/fixtures/dungeon-run-api-fixtures.ts";
import { type DungeonRunObservationApi } from "@frt/api-contract/websocket/dungeon-run/dungeon-run-api-message-schema.ts";
import { type DungeonRunApiObservationStatistics } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";

import { createDungeonRunInterpretationState } from "@/renderer/stores/dungeon-run/dungeon-run-interpretation.ts";

const OBSERVATION: DungeonRunObservationApi = {
  targetId: "42",
  timestampMilliseconds: 10_000,
  type: "UNIT_DEATH",
};

function makeStatistics({
  bestElapsedMilliseconds,
  occurrence,
  sampleCount,
}: {
  readonly bestElapsedMilliseconds: number;
  readonly occurrence: number;
  readonly sampleCount: number;
}): DungeonRunApiObservationStatistics {
  return {
    bestElapsedMilliseconds,
    comparisonGroup: "OWN",
    meanElapsedMilliseconds: bestElapsedMilliseconds + 1_000,
    medianElapsedMilliseconds: bestElapsedMilliseconds + 500,
    occurrence,
    sampleCount,
    targetId: OBSERVATION.targetId,
    type: OBSERVATION.type,
  };
}

function interpretOwnRun({
  observations,
  statistics,
}: {
  readonly observations: ReadonlyArray<DungeonRunObservationApi>;
  readonly statistics: ReadonlyArray<DungeonRunApiObservationStatistics>;
}) {
  return createDungeonRunInterpretationState({
    comparisonGroup: "OWN",
    dungeonRun: MOCK_DUNGEON_RUN_STATE_API.dungeonRun,
    history: {
      comparisonRunCount: 0,
      comparisonSampleCount: 0,
      observations: statistics,
      ownRunCount: 10,
      ownSampleCount: 10,
    },
    observations,
  });
}

describe("createDungeonRunInterpretationState", () => {
  test("matches historical analytics by observation occurrence", () => {
    const state = interpretOwnRun({
      observations: [
        OBSERVATION,
        { ...OBSERVATION, timestampMilliseconds: 15_000 },
      ],
      statistics: [
        makeStatistics({
          bestElapsedMilliseconds: 8_000,
          occurrence: 1,
          sampleCount: 10,
        }),
        makeStatistics({
          bestElapsedMilliseconds: 12_000,
          occurrence: 2,
          sampleCount: 5,
        }),
      ],
    });

    expect(
      state.observations.map(({ analytics, occurrence }) => {
        return { analytics, occurrence };
      }),
    ).toEqual([
      {
        analytics: {
          bestElapsedMilliseconds: 8_000,
          meanElapsedMilliseconds: 9_000,
          medianElapsedMilliseconds: 8_500,
          sampleCount: 10,
        },
        occurrence: 1,
      },
      {
        analytics: {
          bestElapsedMilliseconds: 12_000,
          meanElapsedMilliseconds: 13_000,
          medianElapsedMilliseconds: 12_500,
          sampleCount: 5,
        },
        occurrence: 2,
      },
    ]);
    expect(state.latestObservation?.occurrence).toBe(2);
  });

  test("does not attach analytics when historical statistics do not match the occurrence", () => {
    const state = interpretOwnRun({
      observations: [OBSERVATION],
      statistics: [
        makeStatistics({
          bestElapsedMilliseconds: 8_000,
          occurrence: 2,
          sampleCount: 10,
        }),
      ],
    });

    expect(state.observations).toHaveLength(1);
    expect(state.observations[0]?.occurrence).toBe(1);
    expect(state.observations[0]?.analytics).toBeUndefined();
  });

  test("calculates elapsed times from the dungeon start and the previous observation", () => {
    const state = interpretOwnRun({
      observations: [
        OBSERVATION,
        { ...OBSERVATION, timestampMilliseconds: 15_000 },
      ],
      statistics: [],
    });

    expect(
      state.observations.map(
        ({
          elapsedFromPreviousObservationMilliseconds,
          elapsedFromStartMilliseconds,
        }) => {
          return {
            elapsedFromPreviousObservationMilliseconds,
            elapsedFromStartMilliseconds,
          };
        },
      ),
    ).toEqual([
      {
        elapsedFromPreviousObservationMilliseconds: undefined,
        elapsedFromStartMilliseconds: 9_000,
      },
      {
        elapsedFromPreviousObservationMilliseconds: 5_000,
        elapsedFromStartMilliseconds: 14_000,
      },
    ]);
  });
});
