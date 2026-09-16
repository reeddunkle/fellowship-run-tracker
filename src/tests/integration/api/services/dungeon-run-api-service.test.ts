import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, test } from "vitest";

import {
  DungeonRunObservationDAO,
  type DungeonRunObservationDAOShape,
  type DungeonRunObservationHistory,
} from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import {
  DungeonRunApiService,
  DungeonRunApiServiceLive,
} from "@/services/api/dungeon-run/dungeon-run-api-service.ts";
import {
  DungeonRunRepository,
  type DungeonRunRepositoryShape,
} from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { runTest } from "@/tests/common/run-test.ts";

const observations = [
  {
    elapsedMilliseconds: 10_000,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
  {
    elapsedMilliseconds: 20_000,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
  {
    elapsedMilliseconds: 30_000,
    occurrence: 1,
    targetId: "42",
    type: "UNIT_DEATH",
  },
] satisfies ReadonlyArray<DungeonRunObservationHistory>;

function makeDungeonRunRepositoryTest({
  onDeleteHistory,
}: {
  readonly onDeleteHistory?: (() => void) | undefined;
} = {}): DungeonRunRepositoryShape {
  return {
    completeLocal: () =>
      E.die("Unexpected DungeonRunRepository.completeLocal call."),
    createFellowshipLogsDungeonRun: () =>
      E.die("Unexpected DungeonRunRepository.importFellowshipLogs call."),
    createLocal: () =>
      E.die("Unexpected DungeonRunRepository.createLocal call."),
    delete: () => E.die("Unexpected DungeonRunRepository.delete call."),
    deleteHistory: ({ dungeonId, dungeonLevel }) => {
      return E.sync(() => {
        expect(dungeonId).toBe(MOCK_DUNGEON_ID);
        expect(dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);
        onDeleteHistory?.();
      });
    },
    exitLocal: () => E.die("Unexpected DungeonRunRepository.exitLocal call."),
    interruptLocal: () =>
      E.die("Unexpected DungeonRunRepository.interruptLocal call."),
    listFellowshipLogsDungeonRuns: () =>
      E.die(
        "Unexpected DungeonRunRepository.listFellowshipLogsDungeonRuns call.",
      ),
    startLocal: () => E.die("Unexpected DungeonRunRepository.startLocal call."),
  };
}

function makeDungeonRunObservationDAOTest({
  history,
  onGetHistory,
}: {
  readonly history: ReadonlyArray<DungeonRunObservationHistory>;
  readonly onGetHistory?: (() => void) | undefined;
}): DungeonRunObservationDAOShape {
  return {
    getByDungeonRunId: () =>
      E.die("Unexpected DungeonRunObservationDAO.getByDungeonRunId call."),
    getHistoryByDungeon: ({ dungeonId, dungeonLevel }) => {
      return E.sync(() => {
        expect(dungeonId).toBe(MOCK_DUNGEON_ID);
        expect(dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);

        onGetHistory?.();

        return history;
      });
    },
    observe: () => E.die("Unexpected DungeonRunObservationDAO.observe call."),
  };
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
  const DungeonRunRepositoryTest = Layer.succeed(
    DungeonRunRepository,
    makeDungeonRunRepositoryTest({
      onDeleteHistory,
    }),
  );

  const DungeonRunObservationDAOTest = Layer.succeed(
    DungeonRunObservationDAO,
    makeDungeonRunObservationDAOTest({
      history,
      onGetHistory,
    }),
  );

  return DungeonRunApiServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(DungeonRunObservationDAOTest, DungeonRunRepositoryTest),
    ),
  );
}

describe("DungeonRunApiServiceLive", () => {
  test("returns dungeon run history for a dungeon and level", async () => {
    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result).toEqual({
        observations: [
          {
            bestElapsedMilliseconds: 10_000,
            meanElapsedMilliseconds: 20_000,
            medianElapsedMilliseconds: 20_000,
            occurrence: 1,
            sampleCount: 3,
            targetId: "42",
            type: "UNIT_DEATH",
          },
        ],
      });
    }).pipe(E.provide(makeTestLayer()));

    await runTest(program);
  });

  test("returns empty history when the dungeon and level have no observations", async () => {
    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(result).toEqual({
        observations: [],
      });
    }).pipe(E.provide(makeTestLayer({ history: [] })));

    await runTest(program);
  });

  test("gets observation history for the requested dungeon and level", async () => {
    let getHistoryCallCount = 0;

    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      yield* dungeonRunApiService.getHistory({
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
      const dungeonRunApiService = yield* DungeonRunApiService;

      yield* dungeonRunApiService.deleteHistory({
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
