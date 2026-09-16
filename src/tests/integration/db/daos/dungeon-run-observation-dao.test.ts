import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

const RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");

const FIRST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:10.000Z");

const SECOND_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:20.000Z");

const THIRD_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:30.000Z");

const SECOND_RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T17:00:00.000Z");

const SECOND_RUN_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T17:00:15.000Z");

const createDungeonRun = E.fn("test.create-dungeon-run")(function* () {
  const dungeonRunDAO = yield* DungeonRunDAO;

  return yield* dungeonRunDAO.create({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    endedAt: null,
    source: "LOCAL_LOG",
    startedAt: null,
  });
});

const makeDungeonRunObservationTestContext = E.gen(function* () {
  const dungeonRun = yield* createDungeonRun();
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

  return {
    dungeonRun,
    dungeonRunDAO,
    dungeonRunObservationDAO,
  };
});

describe("DungeonRunObservationDAOLive", () => {
  test("observes and retrieves dungeon run observations", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: SECOND_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "634",
        type: "ABILITY_ACTIVATED",
      });

      const observations = yield* dungeonRunObservationDAO.getByDungeonRunId({
        dungeonRunId: dungeonRun.id,
      });

      expect(observations).toHaveLength(2);

      expect(observations[0]).toMatchObject({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "634",
        type: "ABILITY_ACTIVATED",
      });

      expect(observations[1]).toMatchObject({
        dungeonRunId: dungeonRun.id,
        observedAt: SECOND_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      expect(observations[0]?.id).toBeDefined();
      expect(observations[0]?.createdAt).toBeDefined();
      expect(observations[1]?.id).toBeDefined();
      expect(observations[1]?.createdAt).toBeDefined();
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns no observations for a dungeon run without observations", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      const observations = yield* dungeonRunObservationDAO.getByDungeonRunId({
        dungeonRunId: dungeonRun.id,
      });

      expect(observations).toEqual([]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("does not observe a dungeon run that does not exist", async () => {
    const dungeonRunId = Schema.decodeSync(DungeonRunIdSchema)(
      "00000000-0000-7000-8000-000000000000",
    );

    const program = E.gen(function* () {
      const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

      const error = yield* dungeonRunObservationDAO
        .observe({
          dungeonRunId,
          observedAt: FIRST_OBSERVED_AT,
          targetId: "42",
          type: "UNIT_DEATH",
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunObservationDAOError);
      expect(error.details).toEqual({
        _tag: "RunNotFound",
        dungeonRunId,
      });
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("observes a dungeon run after it has ended", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunDAO, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunDAO.end({
        dungeonRunId: dungeonRun.id,
        endedAt: THIRD_OBSERVED_AT,
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      const observations = yield* dungeonRunObservationDAO.getByDungeonRunId({
        dungeonRunId: dungeonRun.id,
      });

      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns observation history with elapsed time and occurrences", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunDAO, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunDAO.start({
        dungeonRunId: dungeonRun.id,
        startedAt: RUN_STARTED_AT,
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: SECOND_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: THIRD_OBSERVED_AT,
        targetId: "634",
        type: "ABILITY_ACTIVATED",
      });

      const history = yield* dungeonRunObservationDAO.getHistoryByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(history).toEqual([
        {
          elapsedMilliseconds: 30_000,
          occurrence: 1,
          targetId: "634",
          type: "ABILITY_ACTIVATED",
        },
        {
          elapsedMilliseconds: 10_000,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          elapsedMilliseconds: 20_000,
          occurrence: 2,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("calculates occurrences independently for each dungeon run", async () => {
    const program = E.gen(function* () {
      const {
        dungeonRun: firstDungeonRun,
        dungeonRunDAO,
        dungeonRunObservationDAO,
      } = yield* makeDungeonRunObservationTestContext;

      const secondDungeonRun = yield* createDungeonRun();

      yield* dungeonRunDAO.start({
        dungeonRunId: firstDungeonRun.id,
        startedAt: RUN_STARTED_AT,
      });

      yield* dungeonRunDAO.start({
        dungeonRunId: secondDungeonRun.id,
        startedAt: SECOND_RUN_STARTED_AT,
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: firstDungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: firstDungeonRun.id,
        observedAt: SECOND_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: secondDungeonRun.id,
        observedAt: SECOND_RUN_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      const history = yield* dungeonRunObservationDAO.getHistoryByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(history).toEqual([
        {
          elapsedMilliseconds: 10_000,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          elapsedMilliseconds: 15_000,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          elapsedMilliseconds: 20_000,
          occurrence: 2,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("excludes observations from dungeon runs that have not started", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      const history = yield* dungeonRunObservationDAO.getHistoryByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(history).toEqual([]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });
});
