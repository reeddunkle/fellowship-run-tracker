import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  DungeonRunDAO,
  type DungeonRunDAOShape,
} from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { createDungeonRun } from "@frt/db/tests/common/create-dungeon-run.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_ENDED_AT,
  MOCK_DUNGEON_RUN_STARTED_AT,
} from "@frt/db/tests/common/fixtures/dungeon-run-fixtures.ts";
import { getSome } from "@frt/db/tests/common/get-some.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

const MISSING_DUNGEON_RUN_ID = Schema.decodeSync(DungeonRunIdSchema)(
  "00000000-0000-7000-8000-000000000000",
);

function expectDungeonRunNotFound(
  operation: (
    dungeonRunDAO: DungeonRunDAOShape,
  ) => E.Effect<void, DungeonRunDAOError>,
) {
  const program = E.gen(function* () {
    const dungeonRunDAO = yield* DungeonRunDAO;

    const error = yield* operation(dungeonRunDAO).pipe(E.flip);

    expect(error).toBeInstanceOf(DungeonRunDAOError);
    expect(error.reason).toMatchObject({
      _tag: "DungeonRunNotFoundError",
      dungeonRunId: MISSING_DUNGEON_RUN_ID,
    });
  }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

  return runTest(program);
}

describe("DungeonRunDAO", () => {
  test("creates and retrieves a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const created = yield* createDungeonRun();

      expect(created.dungeonId).toBe(MOCK_DUNGEON_ID);
      expect(created.dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);
      expect(created.source).toBe("LOCAL_LOG");
      expect(created.isOwnRun).toBe(true);
      expect(created.startedAt).toBeNull();
      expect(created.endedAt).toBeNull();

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      expect(getSome(result)).toEqual(created);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns none when a dungeon run does not exist", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const result = yield* dungeonRunDAO.getById({
        id: MISSING_DUNGEON_RUN_ID,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("starts and then ends a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;
      const created = yield* createDungeonRun();

      yield* dungeonRunDAO.start({
        dungeonRunId: created.id,
        startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
      });

      const started = getSome(
        yield* dungeonRunDAO.getById({
          id: created.id,
        }),
      );

      expect(started.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(started.endedAt).toBeNull();

      yield* dungeonRunDAO.end({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const ended = getSome(
        yield* dungeonRunDAO.getById({
          id: created.id,
        }),
      );

      expect(ended.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(ended.endedAt).toEqual(MOCK_DUNGEON_RUN_ENDED_AT);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;
      const created = yield* createDungeonRun();

      yield* dungeonRunDAO.delete({
        dungeonRunId: created.id,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes every dungeon run for a dungeon and level with matching ownership", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const firstOwnRun = yield* createDungeonRun({ isOwnRun: true });
      const secondOwnRun = yield* createDungeonRun({ isOwnRun: true });
      const notOwnRun = yield* createDungeonRun({ isOwnRun: false });

      yield* dungeonRunDAO.deleteByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
        isOwnRun: true,
      });

      const firstOwnResult = yield* dungeonRunDAO.getById({
        id: firstOwnRun.id,
      });

      const secondOwnResult = yield* dungeonRunDAO.getById({
        id: secondOwnRun.id,
      });

      const notOwnResult = yield* dungeonRunDAO.getById({
        id: notOwnRun.id,
      });

      expect(Option.isNone(firstOwnResult)).toBe(true);
      expect(Option.isNone(secondOwnResult)).toBe(true);
      expect(Option.isSome(notOwnResult)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deleting dungeon runs by dungeon is idempotent when no runs exist", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      yield* dungeonRunDAO.deleteByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
        isOwnRun: true,
      });

      yield* dungeonRunDAO.deleteByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
        isOwnRun: true,
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  describe("with a missing dungeon run", () => {
    test("fails to delete it", async () => {
      await expectDungeonRunNotFound((dungeonRunDAO) => {
        return dungeonRunDAO.delete({
          dungeonRunId: MISSING_DUNGEON_RUN_ID,
        });
      });
    });

    test("fails to start it", async () => {
      await expectDungeonRunNotFound((dungeonRunDAO) => {
        return dungeonRunDAO.start({
          dungeonRunId: MISSING_DUNGEON_RUN_ID,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        });
      });
    });

    test("fails to end it", async () => {
      await expectDungeonRunNotFound((dungeonRunDAO) => {
        return dungeonRunDAO.end({
          dungeonRunId: MISSING_DUNGEON_RUN_ID,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
        });
      });
    });
  });
});
