import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import {
  MOCK_CONFIGURATION_LABEL,
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
  MOCK_FELLOWSHIP_CONFIGURATION,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";
import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";

const RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T16:00:00.000Z");

const FIRST_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:10.000Z");

const SECOND_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:20.000Z");

const THIRD_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T16:00:30.000Z");

const SECOND_RUN_STARTED_AT = DateTime.makeUnsafe("2026-09-05T17:00:00.000Z");

const SECOND_RUN_OBSERVED_AT = DateTime.makeUnsafe("2026-09-05T17:00:15.000Z");

const createConfigurationDefinition = E.gen(function* () {
  const configurationDAO = yield* ConfigurationDAO;

  const configuration = yield* configurationDAO.save({
    configuration: MOCK_FELLOWSHIP_CONFIGURATION,
    label: MOCK_CONFIGURATION_LABEL,
  });

  return configuration.configurationDefinitionId;
});

function createDungeonRun(
  configurationDefinitionId: ConfigurationDefinitionId,
) {
  return E.gen(function* () {
    const dungeonRunDAO = yield* DungeonRunDAO;

    return yield* dungeonRunDAO.create({
      configurationDefinitionId,
      dungeonId: MOCK_DUNGEON_ID,
      dungeonLevel: MOCK_DUNGEON_LEVEL,
    });
  });
}

const makeDungeonRunObservationTestContext = E.gen(function* () {
  const configurationDefinitionId = yield* createConfigurationDefinition;
  const dungeonRun = yield* createDungeonRun(configurationDefinitionId);
  const dungeonRunDAO = yield* DungeonRunDAO;
  const dungeonRunObservationDAO = yield* DungeonRunObservationDAO;

  return {
    configurationDefinitionId,
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

  test("does not observe an inactive dungeon run", async () => {
    const program = E.gen(function* () {
      const { dungeonRun, dungeonRunDAO, dungeonRunObservationDAO } =
        yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunDAO.complete({
        dungeonRunId: dungeonRun.id,
        endedAt: THIRD_OBSERVED_AT,
      });

      const error = yield* dungeonRunObservationDAO
        .observe({
          dungeonRunId: dungeonRun.id,
          observedAt: FIRST_OBSERVED_AT,
          targetId: "42",
          type: "UNIT_DEATH",
        })
        .pipe(E.flip);

      expect(error).toBeInstanceOf(DungeonRunObservationDAOError);
      expect(error.details).toEqual({
        _tag: "RunNotFoundOrInactive",
        dungeonRunId: dungeonRun.id,
      });

      const observations = yield* dungeonRunObservationDAO.getByDungeonRunId({
        dungeonRunId: dungeonRun.id,
      });

      expect(observations).toEqual([]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns observation history with elapsed time and occurrences", async () => {
    const program = E.gen(function* () {
      const {
        configurationDefinitionId,
        dungeonRun,
        dungeonRunDAO,
        dungeonRunObservationDAO,
      } = yield* makeDungeonRunObservationTestContext;

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

      const history =
        yield* dungeonRunObservationDAO.getHistoryByConfigurationDefinitionId({
          configurationDefinitionId,
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
        configurationDefinitionId,
        dungeonRun: firstDungeonRun,
        dungeonRunDAO,
        dungeonRunObservationDAO,
      } = yield* makeDungeonRunObservationTestContext;

      const secondDungeonRun = yield* createDungeonRun(
        configurationDefinitionId,
      );

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

      const history =
        yield* dungeonRunObservationDAO.getHistoryByConfigurationDefinitionId({
          configurationDefinitionId,
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
      const {
        configurationDefinitionId,
        dungeonRun,
        dungeonRunObservationDAO,
      } = yield* makeDungeonRunObservationTestContext;

      yield* dungeonRunObservationDAO.observe({
        dungeonRunId: dungeonRun.id,
        observedAt: FIRST_OBSERVED_AT,
        targetId: "42",
        type: "UNIT_DEATH",
      });

      const history =
        yield* dungeonRunObservationDAO.getHistoryByConfigurationDefinitionId({
          configurationDefinitionId,
        });

      expect(history).toEqual([]);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });
});
