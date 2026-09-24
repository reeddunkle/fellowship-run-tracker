import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

const RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");

const FIRST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:10.000Z");

const SECOND_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:20.000Z");

const THIRD_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:30.000Z");

const SECOND_RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T17:00:00.000Z");

const SECOND_RUN_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T17:00:15.000Z");

const createDungeonRun = E.fn("test.create-dungeon-run")(function* (options?: {
  readonly isOwnRun?: boolean;
}) {
  const dungeonRunDAO = yield* DungeonRunDAO;

  return yield* dungeonRunDAO.create({
    dungeonId: MOCK_DUNGEON_ID,
    dungeonLevel: MOCK_DUNGEON_LEVEL,
    endedAt: null,
    isOwnRun: options?.isOwnRun ?? true,
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

describe("DungeonRunObservationDAO", () => {
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
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
      expect(error.reason).toMatchObject({
        _tag: "DungeonRunNotFoundError",
        dungeonRunId,
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
          dungeonRunId: dungeonRun.id,
          elapsedMilliseconds: 30_000,
          isOwnRun: true,
          occurrence: 1,
          targetId: "634",
          type: "ABILITY_ACTIVATED",
        },
        {
          dungeonRunId: dungeonRun.id,
          elapsedMilliseconds: 10_000,
          isOwnRun: true,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          dungeonRunId: dungeonRun.id,
          elapsedMilliseconds: 20_000,
          isOwnRun: true,
          occurrence: 2,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ]);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
          dungeonRunId: firstDungeonRun.id,
          elapsedMilliseconds: 10_000,
          isOwnRun: true,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          dungeonRunId: secondDungeonRun.id,
          elapsedMilliseconds: 15_000,
          isOwnRun: true,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          dungeonRunId: firstDungeonRun.id,
          elapsedMilliseconds: 20_000,
          isOwnRun: true,
          occurrence: 2,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ]);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("tags observations with the ownership of their dungeon run", async () => {
    const program = E.gen(function* () {
      const {
        dungeonRun: ownRun,
        dungeonRunDAO,
        dungeonRunObservationDAO,
      } = yield* makeDungeonRunObservationTestContext;

      const notOwnRun = yield* createDungeonRun({ isOwnRun: false });

      yield* dungeonRunDAO.start({
        dungeonRunId: ownRun.id,
        startedAt: RUN_STARTED_AT,
      });

      yield* dungeonRunDAO.start({
        dungeonRunId: notOwnRun.id,
        startedAt: SECOND_RUN_STARTED_AT,
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: ownRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: notOwnRun.id,
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
          dungeonRunId: notOwnRun.id,
          elapsedMilliseconds: 15_000,
          isOwnRun: false,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
        {
          dungeonRunId: ownRun.id,
          elapsedMilliseconds: 10_000,
          isOwnRun: true,
          occurrence: 1,
          targetId: "42",
          type: "UNIT_DEATH",
        },
      ]);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

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
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
