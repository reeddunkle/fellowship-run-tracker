import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import {
  MOCK_CONFIGURATION_LABEL,
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_ENDED_AT,
  MOCK_DUNGEON_RUN_STARTED_AT,
} from "@/tests/common/fixtures/dungeon-run-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";
import { DungeonRunIdSchema } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

const configuration = {
  dungeonId: MOCK_DUNGEON_ID,
  dungeonLevel: MOCK_DUNGEON_LEVEL,
  milestones: [],
} satisfies FellowshipMilestoneConfiguration;

function getDungeonRun<T>(dungeonRun: Option.Option<T>): T {
  if (Option.isNone(dungeonRun)) {
    throw new Error("Expected dungeon run to exist.");
  }

  return dungeonRun.value;
}

const makeDungeonRunTestContext = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;
  const dungeonRunDAO = yield* DungeonRunDAO;

  const persistedConfiguration = yield* configurationDAO.save({
    configuration,
    label: MOCK_CONFIGURATION_LABEL,
  });

  return {
    configurationDefinitionId: persistedConfiguration.configurationDefinitionId,
    dungeonRunDAO,
  };
});

describe("DungeonRunDAOLive", () => {
  test("creates and retrieves an active dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      expect(created.id).toBeDefined();
      expect(created.configurationDefinitionId).toBe(configurationDefinitionId);
      expect(created.dungeonId).toBe(MOCK_DUNGEON_ID);
      expect(created.dungeonLevel).toBe(MOCK_DUNGEON_LEVEL);
      expect(created.status).toBe("ACTIVE");
      expect(created.startedAt).toBeNull();
      expect(created.endedAt).toBeNull();
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      expect(getDungeonRun(result)).toEqual(created);
    }).pipe(E.provide(makePersistenceTestLayer()));

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
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("starts an active dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.start({
        dungeonRunId: created.id,
        startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.status).toBe("ACTIVE");
      expect(persisted.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(persisted.endedAt).toBeNull();
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("completes an active dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.start({
        dungeonRunId: created.id,
        startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
      });

      yield* dungeonRunDAO.complete({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.status).toBe("COMPLETED");
      expect(persisted.startedAt).toEqual(MOCK_DUNGEON_RUN_STARTED_AT);
      expect(persisted.endedAt).toEqual(MOCK_DUNGEON_RUN_ENDED_AT);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("exits an active dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.exit({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.status).toBe("EXITED");
      expect(persisted.endedAt).toEqual(MOCK_DUNGEON_RUN_ENDED_AT);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("interrupts an active dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.interrupt({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const result = yield* dungeonRunDAO.getById({
        id: created.id,
      });

      const persisted = getDungeonRun(result);

      expect(persisted.status).toBe("INTERRUPTED");
      expect(persisted.endedAt).toEqual(MOCK_DUNGEON_RUN_ENDED_AT);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes all historical dungeon runs for a configuration definition", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const firstDungeonRun = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      const secondDungeonRun = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.complete({
        dungeonRunId: firstDungeonRun.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      yield* dungeonRunDAO.exit({
        dungeonRunId: secondDungeonRun.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      yield* dungeonRunDAO.deleteHistoryByConfigurationDefinitionId({
        configurationDefinitionId,
      });

      const firstResult = yield* dungeonRunDAO.getById({
        id: firstDungeonRun.id,
      });

      const secondResult = yield* dungeonRunDAO.getById({
        id: secondDungeonRun.id,
      });

      expect(Option.isNone(firstResult)).toBe(true);
      expect(Option.isNone(secondResult)).toBe(true);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("deleting dungeon runs is idempotent when no runs exist", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      yield* dungeonRunDAO.deleteHistoryByConfigurationDefinitionId({
        configurationDefinitionId,
      });

      yield* dungeonRunDAO.deleteHistoryByConfigurationDefinitionId({
        configurationDefinitionId,
      });
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("does not finish an inactive dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.complete({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const error = yield* dungeonRunDAO
        .complete({
          dungeonRunId: created.id,
          endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunDAOError);
      expect(error.details).toEqual({
        _tag: "RunNotFoundOrInactive",
        dungeonRunId: created.id,
      });
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("does not start an inactive dungeon run", async () => {
    const program = E.gen(function* () {
      const { configurationDefinitionId, dungeonRunDAO } =
        yield* makeDungeonRunTestContext;

      const created = yield* dungeonRunDAO.create({
        configurationDefinitionId,
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      yield* dungeonRunDAO.complete({
        dungeonRunId: created.id,
        endedAt: MOCK_DUNGEON_RUN_ENDED_AT,
      });

      const error = yield* dungeonRunDAO
        .start({
          dungeonRunId: created.id,
          startedAt: MOCK_DUNGEON_RUN_STARTED_AT,
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunDAOError);
      expect(error.details).toEqual({
        _tag: "RunNotFoundOrInactive",
        dungeonRunId: created.id,
      });
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });
});
