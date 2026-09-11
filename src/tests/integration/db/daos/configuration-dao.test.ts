import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { describe, expect, test } from "vitest";

import { createConfigurationFingerprint } from "@/application/configurations/configuration-fingerprint.ts";
import {
  ConfigurationDAO,
  type PersistedConfiguration,
} from "@/db/daos/configuration/configuration-dao.ts";
import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import {
  MOCK_ALTERNATE_DUNGEON_ID,
  MOCK_CONFIGURATION_LABEL,
  MOCK_DUNGEON_ID,
  MOCK_DUNGEON_LEVEL,
  MOCK_FELLOWSHIP_CONFIGURATION,
  MOCK_UNKNOWN_CONFIGURATION_ID,
  MOCK_UPDATED_CONFIGURATION_LABEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

function getPersistedConfiguration(
  persisted: Option.Option<PersistedConfiguration>,
): PersistedConfiguration {
  if (Option.isNone(persisted)) {
    throw new Error("Expected persisted configuration.");
  }

  return persisted.value;
}

describe("ConfigurationDAOLive", () => {
  test("creates and retrieves a configuration", async () => {
    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const expectedFingerprint = yield* createConfigurationFingerprint(
        MOCK_FELLOWSHIP_CONFIGURATION,
      );

      const created = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      expect(created.id).toBeDefined();
      expect(created.configurationDefinitionId).toBeDefined();
      expect(created.configuration).toEqual(MOCK_FELLOWSHIP_CONFIGURATION);
      expect(created.fingerprint).toBe(expectedFingerprint.fingerprint);
      expect(created.label).toBe(MOCK_CONFIGURATION_LABEL);

      const result = yield* configurationDAO.getById({
        id: created.id,
      });

      expect(getPersistedConfiguration(result)).toEqual(created);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns none when a configuration does not exist", async () => {
    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const result = yield* configurationDAO.getById({
        id: MOCK_UNKNOWN_CONFIGURATION_ID,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("allows otherwise identical configurations at different dungeon levels", async () => {
    const differentLevelConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      dungeonLevel: MOCK_FELLOWSHIP_CONFIGURATION.dungeonLevel + 1,
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const first = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const second = yield* configurationDAO.save({
        configuration: differentLevelConfiguration,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      expect(second.id).not.toBe(first.id);
      expect(second.configurationDefinitionId).not.toBe(
        first.configurationDefinitionId,
      );
      expect(second.fingerprint).not.toBe(first.fingerprint);

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(2);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes a configuration", async () => {
    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const created = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      yield* configurationDAO.delete({
        id: created.id,
      });

      const result = yield* configurationDAO.getById({
        id: created.id,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("deletes configurations matching a dungeon and level", async () => {
    const matchingConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      milestones: MOCK_FELLOWSHIP_CONFIGURATION.milestones.slice(0, 2),
    } satisfies FellowshipMilestoneConfiguration;

    const differentLevelConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      dungeonLevel: MOCK_DUNGEON_LEVEL + 1,
    } satisfies FellowshipMilestoneConfiguration;

    const differentDungeonConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      dungeonId: MOCK_ALTERNATE_DUNGEON_ID,
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const first = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const second = yield* configurationDAO.save({
        configuration: matchingConfiguration,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      const differentLevel = yield* configurationDAO.save({
        configuration: differentLevelConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const differentDungeon = yield* configurationDAO.save({
        configuration: differentDungeonConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      yield* configurationDAO.deleteByDungeonAndLevel({
        dungeonId: MOCK_DUNGEON_ID,
        dungeonLevel: MOCK_DUNGEON_LEVEL,
      });

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(2);

      expect(
        persistedConfigurations.map((persisted) => {
          return persisted.id;
        }),
      ).toEqual(
        expect.arrayContaining([differentLevel.id, differentDungeon.id]),
      );

      expect(
        persistedConfigurations.map((persisted) => {
          return persisted.id;
        }),
      ).not.toEqual(expect.arrayContaining([first.id, second.id]));
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("returns all persisted configurations", async () => {
    const secondConfiguration = {
      dungeonId: MOCK_ALTERNATE_DUNGEON_ID,
      dungeonLevel: MOCK_DUNGEON_LEVEL,
      milestones: [
        {
          comparisonTime: null,
          label: "Ghorn Defeated",
          requirements: [
            {
              requiredCount: 1,
              startOccurrence: 1,
              type: "UNIT_DEATH",
              unitTypeId: "280",
            },
          ],
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const first = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const second = yield* configurationDAO.save({
        configuration: secondConfiguration,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(2);

      expect(
        persistedConfigurations.map((persisted) => {
          return persisted.id;
        }),
      ).toEqual(expect.arrayContaining([first.id, second.id]));

      expect(
        persistedConfigurations.map((persisted) => {
          return persisted.label;
        }),
      ).toEqual(
        expect.arrayContaining([
          MOCK_CONFIGURATION_LABEL,
          MOCK_UPDATED_CONFIGURATION_LABEL,
        ]),
      );

      expect(
        persistedConfigurations.map((persisted) => {
          return persisted.fingerprint;
        }),
      ).toEqual(
        expect.arrayContaining([first.fingerprint, second.fingerprint]),
      );
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("persists configurations across database restarts", async () => {
    const program = E.scoped(
      E.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "fellowship-run-tracker-",
        });

        const databaseFilename = path.join(
          temporaryDirectory,
          "fellowship-run-tracker.db",
        );

        const createProgram = E.gen(function* () {
          const configurationDAO = yield* ConfigurationDAO;

          return yield* configurationDAO.save({
            configuration: MOCK_FELLOWSHIP_CONFIGURATION,
            label: MOCK_CONFIGURATION_LABEL,
          });
        }).pipe(E.provide(makePersistenceTestLayer(databaseFilename)));

        const created = yield* createProgram;

        const readProgram = E.gen(function* () {
          const configurationDAO = yield* ConfigurationDAO;

          const result = yield* configurationDAO.getById({
            id: created.id,
          });

          return getPersistedConfiguration(result);
        }).pipe(E.provide(makePersistenceTestLayer(databaseFilename)));

        const persisted = yield* readProgram;

        expect(persisted).toEqual(created);
      }),
    ).pipe(E.provide(NodePlatformLive));

    await runTest(program);
  });
});
