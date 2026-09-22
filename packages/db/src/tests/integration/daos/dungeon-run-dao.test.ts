import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import {
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_ENDED_AT,
  MOCK_DUNGEON_RUN_STARTED_AT,
} from "@frt/db/tests/common/fixtures/dungeon-run-fixtures.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@frt/shared/validation/dungeon-run/dungeon-run-id-schema.ts";

function getDungeonRun<T>(dungeonRun: Option.Option<T>): T {
  if (Option.isNone(dungeonRun)) {
    throw new Error("Expected dungeon run to exist.");
  }

  return dungeonRun.value;
}

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

describe("DungeonRunDAO", () => {
  test("creates and retrieves a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const created = yield* createDungeonRun();

      expect(created.id).toBeDefined();
      expect(created.dungeonId).toBe(MOCK_DUNGEON_ID);
      expect(created.dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);
      expect(created.source).toBe("LOCAL_LOG");
      expect(created.isOwnRun).toBe(true);
      expect(created.startedAt).toBeNull();
      expect(created.endedAt).toBeNull();
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      expect(getDungeonRun(result)).toEqual(created);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns none when a dungeon run does not exist", async () => {
    const dungeonRunId = Schema.decodeSync(DungeonRunIdSchema)(
      "00000000-0000-7000-8000-000000000000",
    );

    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const result = yield* dungeonRunDAO.getById({
        id: dungeonRunId,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("starts a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;
      const created = yield* createDungeonRun();

      yield* dungeonRunDAO.start({
        dungeonRunId: created.id,
        startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(persisted.endedAt).toBeNull();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("ends a dungeon run", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;
      const created = yield* createDungeonRun();

      yield* dungeonRunDAO.start({
        dungeonRunId: created.id,
        startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
      });

      yield* dungeonRunDAO.end({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(persisted.endedAt).toEqual(MOCK_DUNGEON_RUN_ENDED_AT);
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

  test("fails when deleting a dungeon run that does not exist", async () => {
    const dungeonRunId = Schema.decodeSync(DungeonRunIdSchema)(
      "00000000-0000-7000-8000-000000000000",
    );

    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const error = yield* dungeonRunDAO
        .delete({
          dungeonRunId,
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunDAOError);
      expect(error.reason).toMatchObject({
        _tag: "DungeonRunNotFoundError",
        dungeonRunId,
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes all dungeon runs for a dungeon and level matching ownership", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const firstDungeonRun = yield* createDungeonRun();
      const secondDungeonRun = yield* createDungeonRun();

      yield* dungeonRunDAO.deleteByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
        isOwnRun: true,
      });

      const firstResult = yield* dungeonRunDAO.getById({
        id: firstDungeonRun.id,
      });

      const secondResult = yield* dungeonRunDAO.getById({
        id: secondDungeonRun.id,
      });

      expect(Option.isNone(firstResult)).toBe(true);
      expect(Option.isNone(secondResult)).toBe(true);
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("leaves dungeon runs with a different ownership untouched", async () => {
    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const ownRun = yield* createDungeonRun({ isOwnRun: true });
      const notOwnRun = yield* createDungeonRun({ isOwnRun: false });

      yield* dungeonRunDAO.deleteByDungeon({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
        isOwnRun: true,
      });

      const ownResult = yield* dungeonRunDAO.getById({
        id: ownRun.id,
      });

      const notOwnResult = yield* dungeonRunDAO.getById({
        id: notOwnRun.id,
      });

      expect(Option.isNone(ownResult)).toBe(true);
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

  test("fails when starting a dungeon run that does not exist", async () => {
    const dungeonRunId = Schema.decodeSync(DungeonRunIdSchema)(
      "00000000-0000-7000-8000-000000000000",
    );

    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const error = yield* dungeonRunDAO
        .start({
          dungeonRunId,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunDAOError);
      expect(error.reason).toMatchObject({
        _tag: "DungeonRunNotFoundError",
        dungeonRunId,
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });

  test("fails when ending a dungeon run that does not exist", async () => {
    const dungeonRunId = Schema.decodeSync(DungeonRunIdSchema)(
      "00000000-0000-7000-8000-000000000000",
    );

    const program = E.gen(function* () {
      const dungeonRunDAO = yield* DungeonRunDAO;

      const error = yield* dungeonRunDAO
        .end({
          dungeonRunId,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunDAOError);
      expect(error.reason).toMatchObject({
        _tag: "DungeonRunNotFoundError",
        dungeonRunId,
      });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()));

    await runTest(program);
  });
});
