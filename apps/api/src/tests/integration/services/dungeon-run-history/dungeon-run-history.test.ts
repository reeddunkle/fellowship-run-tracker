import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { DungeonRunHistory } from "@frt/api/services/dungeon-run-history/dungeon-run-history-service.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  DungeonRunObservationDAO,
  type DungeonRunObservationHistory,
} from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

const FIRST_OWN_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000001",
);

const SECOND_OWN_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000002",
);

const THIRD_OWN_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000003",
);

const COMPARISON_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000004",
);

const observations = [
  {
    dungeonRunId: FIRST_OWN_DUNGEON_RUN_ID,
    elapsedMilliseconds: 10_000,
    isOwnRun: true,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
  {
    dungeonRunId: SECOND_OWN_DUNGEON_RUN_ID,
    elapsedMilliseconds: 20_000,
    isOwnRun: true,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
  {
    dungeonRunId: THIRD_OWN_DUNGEON_RUN_ID,
    elapsedMilliseconds: 30_000,
    isOwnRun: true,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
  {
    dungeonRunId: COMPARISON_DUNGEON_RUN_ID,
    elapsedMilliseconds: 15_000,
    isOwnRun: false,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
] satisfies ReadonlyArray<DungeonRunObservationHistory>;

function makeDungeonRunRepositoryTestLayer({
  onDeleteHistory,
}: {
  readonly onDeleteHistory?: (() => void) | undefined;
} = {}) {
  return Layer.mock(DungeonRunRepository, {
    deleteHistory: ({ dungeonId, dungeonLevel }) => {
      return E.sync(() => {
        expect(dungeonId).toBe(MOCK_DUNGEON_ID);
        expect(dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);
        onDeleteHistory?.();
      });
    },
  });
}

function makeDungeonRunObservationDAOTestLayer({
  history,
  onGetHistory,
}: {
  readonly history: ReadonlyArray<DungeonRunObservationHistory>;
  readonly onGetHistory?: (() => void) | undefined;
}) {
  return Layer.mock(DungeonRunObservationDAO, {
    getHistoryByDungeon: ({ dungeonId, dungeonLevel }) => {
      return E.sync(() => {
        expect(dungeonId).toBe(MOCK_DUNGEON_ID);
        expect(dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);

        onGetHistory?.();

        return history;
      });
    },
  });
}

function makeTestLayer({
  history = observations,
  onDeleteHistory,
  onGetHistory,
}: {
  readonly history?: ReadonlyArray<DungeonRunObservationHistory>;
  readonly onDeleteHistory?: () => void;
  readonly onGetHistory?: () => void;
} = {}) {
  return DungeonRunHistory.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        makeDungeonRunObservationDAOTestLayer({ history, onGetHistory }),
        makeDungeonRunRepositoryTestLayer({ onDeleteHistory }),
      ),
    ),
  );
}

describe("DungeonRunHistory", () => {
  test("returns dungeon run history grouped by ownership for a dungeon and level", async () => {
    const program = E.gen(function* () {
      const dungeonRunHistory = yield* DungeonRunHistory;

      const result = yield* dungeonRunHistory.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result).toEqual({
        comparisonRunCount: 1,
        comparisonSampleCount: 1,
        observations: [
          {
            bestElapsedMilliseconds: 10_000,
            comparisonGroup: "ALL",
            meanElapsedMilliseconds: 18_750,
            medianElapsedMilliseconds: 17_500,
            occurrence: 1,
            sampleCount: 4,
            targetId: "42",
            type: "UNIT_DEATH",
          },
          {
            bestElapsedMilliseconds: 15_000,
            comparisonGroup: "COMPARISON",
            meanElapsedMilliseconds: 15_000,
            medianElapsedMilliseconds: 15_000,
            occurrence: 1,
            sampleCount: 1,
            targetId: "42",
            type: "UNIT_DEATH",
          },
          {
            bestElapsedMilliseconds: 10_000,
            comparisonGroup: "OWN",
            meanElapsedMilliseconds: 20_000,
            medianElapsedMilliseconds: 20_000,
            occurrence: 1,
            sampleCount: 3,
            targetId: "42",
            type: "UNIT_DEATH",
          },
        ],
        ownRunCount: 3,
        ownSampleCount: 3,
      });
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });

  test("returns empty history when the dungeon and level have no observations", async () => {
    const program = E.gen(function* () {
      const dungeonRunHistory = yield* DungeonRunHistory;

      const result = yield* dungeonRunHistory.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result).toEqual({
        comparisonRunCount: 0,
        comparisonSampleCount: 0,
        observations: [],
        ownRunCount: 0,
        ownSampleCount: 0,
      });
    }).pipe(E.provide(makeTestLayer({ history: [] })));

    await runTest(program);
  });

  test("gets observation history for the requested dungeon and level once", async () => {
    let getHistoryCallCount = 0;

    const program = E.gen(function* () {
      const dungeonRunHistory = yield* DungeonRunHistory;

      yield* dungeonRunHistory.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });
    }).pipe(
      E.provide(
        makeTestLayer({
          onGetHistory: () => {
            getHistoryCallCount += 1;
          },
        }),
      ),
    );

    await runTest(program);

    expect(getHistoryCallCount).toBe(1);
  });

  test("deletes dungeon run history for a dungeon and level", async () => {
    let deleteCallCount = 0;

    const program = E.gen(function* () {
      const dungeonRunHistory = yield* DungeonRunHistory;

      yield* dungeonRunHistory.deleteHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });
    }).pipe(
      E.provide(
        makeTestLayer({
          onDeleteHistory: () => {
            deleteCallCount += 1;
          },
        }),
      ),
    );

    await runTest(program);

    expect(deleteCallCount).toBe(1);
  });
});
