import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { DungeonRunApiService } from "@frt/api/services/api/dungeon-run/dungeon-run-api-service.ts";
import {
  makeDungeonRunApiServiceIntegrationTestHarness,
  seedDungeonRunWithObservations,
} from "@frt/api/tests/common/harnesses/dungeon-run-api-service-integration-test-harness.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

const FIRST_OWN_RUN_STARTED_AT = DateTime.makeUnsafe(
  "2026-09-05T16:00:00.000Z",
);

const SECOND_OWN_RUN_STARTED_AT = DateTime.makeUnsafe(
  "2026-09-05T17:00:00.000Z",
);

const FIRST_COMPARISON_RUN_STARTED_AT = DateTime.makeUnsafe(
  "2026-09-05T18:00:00.000Z",
);

const SECOND_COMPARISON_RUN_STARTED_AT = DateTime.makeUnsafe(
  "2026-09-05T19:00:00.000Z",
);

const seedHistoryFixture = E.gen(function* () {
  yield* seedDungeonRunWithObservations({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    isOwnRun: true,
    observations: [
      {
        observedAt: DateTime.addDuration(
          FIRST_OWN_RUN_STARTED_AT,
          "10 seconds",
        ),
        targetId: "42",
        type: "UNIT_DEATH",
      },
    ],
    startedAt: FIRST_OWN_RUN_STARTED_AT,
  });

  yield* seedDungeonRunWithObservations({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    isOwnRun: true,
    observations: [
      {
        observedAt: DateTime.addDuration(
          SECOND_OWN_RUN_STARTED_AT,
          "20 seconds",
        ),
        targetId: "42",
        type: "UNIT_DEATH",
      },
    ],
    startedAt: SECOND_OWN_RUN_STARTED_AT,
  });

  yield* seedDungeonRunWithObservations({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    isOwnRun: false,
    observations: [
      {
        observedAt: DateTime.addDuration(
          FIRST_COMPARISON_RUN_STARTED_AT,
          "15 seconds",
        ),
        targetId: "42",
        type: "UNIT_DEATH",
      },
    ],
    startedAt: FIRST_COMPARISON_RUN_STARTED_AT,
  });

  yield* seedDungeonRunWithObservations({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    isOwnRun: false,
    observations: [
      {
        observedAt: DateTime.addDuration(
          SECOND_COMPARISON_RUN_STARTED_AT,
          "25 seconds",
        ),
        targetId: "42",
        type: "UNIT_DEATH",
      },
    ],
    startedAt: SECOND_COMPARISON_RUN_STARTED_AT,
  });
});

describe("DungeonRunApiService against real seeded data", () => {
  test("computes best/mean/median and run/sample counts per ownership group", async () => {
    const harness = makeDungeonRunApiServiceIntegrationTestHarness();

    const program = E.gen(function* () {
      yield* seedHistoryFixture;

      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result).toEqual({
        comparisonRunCount: 2,
        comparisonSampleCount: 2,
        observations: [
          {
            bestElapsedMilliseconds: 10_000,
            comparisonGroup: "ALL",
            meanElapsedMilliseconds: 17_500,
            medianElapsedMilliseconds: 17_500,
            occurrence: 1,
            sampleCount: 4,
            targetId: "42",
            type: "UNIT_DEATH",
          },
          {
            bestElapsedMilliseconds: 15_000,
            comparisonGroup: "COMPARISON",
            meanElapsedMilliseconds: 20_000,
            medianElapsedMilliseconds: 20_000,
            occurrence: 1,
            sampleCount: 2,
            targetId: "42",
            type: "UNIT_DEATH",
          },
          {
            bestElapsedMilliseconds: 10_000,
            comparisonGroup: "OWN",
            meanElapsedMilliseconds: 15_000,
            medianElapsedMilliseconds: 15_000,
            occurrence: 1,
            sampleCount: 2,
            targetId: "42",
            type: "UNIT_DEATH",
          },
        ],
        ownRunCount: 2,
        ownSampleCount: 2,
      });
    }).pipe(E.provide(harness.layer));

    await runTest(program);
  });

  test("deleting history through the real DAO stack only removes the user's own runs", async () => {
    const harness = makeDungeonRunApiServiceIntegrationTestHarness();

    const program = E.gen(function* () {
      yield* seedHistoryFixture;

      const dungeonRunApiService = yield* DungeonRunApiService;

      yield* dungeonRunApiService.deleteHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      const result = yield* dungeonRunApiService.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result.ownRunCount).toBe(0);
      expect(result.ownSampleCount).toBe(0);
      expect(result.comparisonRunCount).toBe(2);
      expect(result.comparisonSampleCount).toBe(2);
    }).pipe(E.provide(harness.layer));

    await runTest(program);
  });
});
