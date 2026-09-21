import * as E from "effect/Effect";
import * as Result from "effect/Result";
import { describe, expect, test } from "vitest";

import { ConfigurationDAO } from "@/db/daos/configuration/configuration-dao.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import {
  MOCK_ALTERNATE_DUNGEON_ID,
  MOCK_CONFIGURATION_LABEL,
  MOCK_FELLOWSHIP_CONFIGURATION,
  MOCK_UPDATED_CONFIGURATION_LABEL,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { makePersistenceTestLayer } from "@/tests/common/layers/persistence-test-layer.ts";
import { runTest } from "@/tests/common/run-test.ts";

const [
  firstDesecratorMilestone,
  secondDesecratorMilestone,
  bossPullMilestone,
  combinedMilestone,
] = MOCK_FELLOWSHIP_CONFIGURATION.milestones;

if (
  firstDesecratorMilestone === undefined ||
  secondDesecratorMilestone === undefined ||
  bossPullMilestone === undefined ||
  combinedMilestone === undefined
) {
  throw new Error("Expected configuration fixture milestones.");
}

const combinedUnitDeathRequirement = combinedMilestone.requirements[0];
const combinedAbilityRequirement = combinedMilestone.requirements[1];

if (
  combinedUnitDeathRequirement === undefined ||
  combinedAbilityRequirement === undefined
) {
  throw new Error("Expected combined milestone requirements.");
}

describe("ConfigurationDAO identity", () => {
  test("rejects saving an exact duplicate configuration", async () => {
    const duplicateConfiguration = {
      dungeonId: MOCK_FELLOWSHIP_CONFIGURATION.dungeonId,
      dungeonLevel: MOCK_FELLOWSHIP_CONFIGURATION.dungeonLevel,
      milestones: [
        {
          ...combinedMilestone,
          label: "Different Combined Label",
          requirements: [
            combinedAbilityRequirement,
            combinedUnitDeathRequirement,
          ],
        },
        {
          ...bossPullMilestone,
          label: "Different Boss Pull Label",
        },
        {
          ...secondDesecratorMilestone,
          label: "Different Second Desecrator Label",
        },
        {
          ...firstDesecratorMilestone,
          label: "Different First Desecrator Label",
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const result = yield* configurationDAO
        .save({
          configuration: duplicateConfiguration,
          label: MOCK_UPDATED_CONFIGURATION_LABEL,
        })
        .pipe(E.result);

      expect(Result.isFailure(result)).toBe(true);

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(1);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("updates configuration metadata without changing its identity", async () => {
    const updatedConfiguration = {
      dungeonId: MOCK_FELLOWSHIP_CONFIGURATION.dungeonId,
      dungeonLevel: MOCK_FELLOWSHIP_CONFIGURATION.dungeonLevel,
      milestones: [
        {
          ...combinedMilestone,
          label: "Updated Combined Label",
          requirements: [
            combinedAbilityRequirement,
            combinedUnitDeathRequirement,
          ],
        },
        {
          ...bossPullMilestone,
          label: "Updated Boss Pull Label",
        },
        {
          ...secondDesecratorMilestone,
          label: "Updated Second Desecrator Label",
        },
        {
          ...firstDesecratorMilestone,
          label: "Updated First Desecrator Label",
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const created = yield* configurationDAO.save({
        configuration: MOCK_FELLOWSHIP_CONFIGURATION,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const updated = yield* configurationDAO.update({
        configuration: updatedConfiguration,
        id: created.id,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.configurationDefinitionId).toBe(
        created.configurationDefinitionId,
      );
      expect(updated.fingerprint).toBe(created.fingerprint);
      expect(updated.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

      expect(
        updated.configuration.milestones.map((milestone) => {
          return milestone.label;
        }),
      ).toEqual(
        expect.arrayContaining([
          "Updated First Desecrator Label",
          "Updated Second Desecrator Label",
          "Updated Boss Pull Label",
          "Updated Combined Label",
        ]),
      );

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(1);
      expect(persistedConfigurations[0]).toEqual(updated);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("shares a configuration definition between different milestone arrangements", async () => {
    const differentlyGroupedConfiguration = {
      dungeonId: MOCK_FELLOWSHIP_CONFIGURATION.dungeonId,
      dungeonLevel: MOCK_FELLOWSHIP_CONFIGURATION.dungeonLevel,
      milestones: [
        {
          comparisonTime: null,
          label: "Desecrators",
          requirements: [
            firstDesecratorMilestone.requirements[0],
            secondDesecratorMilestone.requirements[0],
          ],
        },
        {
          comparisonTime: null,
          label: "Everything Else",
          requirements: [
            bossPullMilestone.requirements[0],
            combinedUnitDeathRequirement,
            combinedAbilityRequirement,
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
        configuration: differentlyGroupedConfiguration,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      expect(second.id).not.toBe(first.id);
      expect(second.fingerprint).not.toBe(first.fingerprint);
      expect(second.configurationDefinitionId).toBe(
        first.configurationDefinitionId,
      );
      expect(second.configuration).toEqual(differentlyGroupedConfiguration);

      const persistedConfigurations = yield* configurationDAO.getAll();

      expect(persistedConfigurations).toHaveLength(2);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("saves a configuration and replaces other configurations for the same dungeon and level", async () => {
    const existingConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      milestones: [firstDesecratorMilestone],
    } satisfies FellowshipMilestoneConfiguration;

    const replacementConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      milestones: [firstDesecratorMilestone, secondDesecratorMilestone],
    } satisfies FellowshipMilestoneConfiguration;

    const differentLevelConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      dungeonLevel: MOCK_FELLOWSHIP_CONFIGURATION.dungeonLevel + 1,
    } satisfies FellowshipMilestoneConfiguration;

    const differentDungeonConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      dungeonId: MOCK_ALTERNATE_DUNGEON_ID,
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const existing = yield* configurationDAO.save({
        configuration: existingConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const differentLevel = yield* configurationDAO.save({
        configuration: differentLevelConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const differentDungeon = yield* configurationDAO.save({
        configuration: differentDungeonConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const replacement = yield* configurationDAO.saveReplacingDungeonAndLevel({
        configuration: replacementConfiguration,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
      });

      expect(replacement.id).not.toBe(existing.id);
      expect(replacement.configuration).toEqual(replacementConfiguration);
      expect(replacement.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

      const persistedConfigurations = yield* configurationDAO.getAll();
      const persistedIds = persistedConfigurations.map((persisted) => {
        return persisted.id;
      });

      expect(persistedConfigurations).toHaveLength(3);
      expect(persistedIds).toEqual(
        expect.arrayContaining([
          replacement.id,
          differentLevel.id,
          differentDungeon.id,
        ]),
      );
      expect(persistedIds).not.toContain(existing.id);
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });

  test("rejects replacing with an existing duplicate configuration", async () => {
    const oldConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      milestones: [firstDesecratorMilestone],
    } satisfies FellowshipMilestoneConfiguration;

    const retainedConfiguration = {
      ...MOCK_FELLOWSHIP_CONFIGURATION,
      milestones: [secondDesecratorMilestone],
    } satisfies FellowshipMilestoneConfiguration;

    const duplicateRetainedConfiguration = {
      dungeonId: retainedConfiguration.dungeonId,
      dungeonLevel: retainedConfiguration.dungeonLevel,
      milestones: [
        {
          ...secondDesecratorMilestone,
          label: "Updated Milestone Label",
        },
      ],
    } satisfies FellowshipMilestoneConfiguration;

    const program = E.gen(function* () {
      const configurationDAO = yield* ConfigurationDAO;

      const old = yield* configurationDAO.save({
        configuration: oldConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const retained = yield* configurationDAO.save({
        configuration: retainedConfiguration,
        label: MOCK_CONFIGURATION_LABEL,
      });

      const result = yield* configurationDAO
        .saveReplacingDungeonAndLevel({
          configuration: duplicateRetainedConfiguration,
          label: MOCK_UPDATED_CONFIGURATION_LABEL,
        })
        .pipe(E.result);

      expect(Result.isFailure(result)).toBe(true);

      const persistedConfigurations = yield* configurationDAO.getAll();
      const persistedIds = persistedConfigurations.map((persisted) => {
        return persisted.id;
      });

      expect(persistedConfigurations).toHaveLength(2);
      expect(persistedIds).toEqual(
        expect.arrayContaining([old.id, retained.id]),
      );
    }).pipe(E.provide(makePersistenceTestLayer()));

    await runTest(program);
  });
});
