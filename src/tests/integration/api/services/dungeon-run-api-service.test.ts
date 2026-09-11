import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { describe, expect, test } from "vitest";

import {
  ConfigurationDAO,
  type ConfigurationDAOShape,
  type PersistedConfiguration,
} from "@/db/daos/configuration/configuration-dao.ts";
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
  MOCK_CONFIGURATION_DEFINITION_ID,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
  MOCK_CONFIGURATION_LABEL,
  MOCK_FELLOWSHIP_CONFIGURATION,
  MOCK_UNKNOWN_CONFIGURATION_ID,
} from "@/tests/common/fixtures/configuration-fixtures.ts";
import { runTest } from "@/tests/common/run-test.ts";

const CONFIGURATION_CREATED_AT = DateTime.makeUnsafe(
  "2026-01-01T00:00:00.000Z",
);

const CONFIGURATION_UPDATED_AT = DateTime.makeUnsafe(
  "2026-01-02T00:00:00.000Z",
);

const persistedConfiguration = {
  configuration: MOCK_FELLOWSHIP_CONFIGURATION,
  configurationDefinitionId: MOCK_CONFIGURATION_DEFINITION_ID,
  createdAt: CONFIGURATION_CREATED_AT,
  fingerprint: MOCK_CONFIGURATION_FINGERPRINT,
  id: MOCK_CONFIGURATION_ID,
  label: MOCK_CONFIGURATION_LABEL,
  updatedAt: CONFIGURATION_UPDATED_AT,
} satisfies PersistedConfiguration;

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

function makeConfigurationDAOTest(
  configuration: Option.Option<PersistedConfiguration>,
): ConfigurationDAOShape {
  return {
    delete: () => E.die("Unexpected ConfigurationDAO.delete call."),
    deleteByDungeonAndLevel: () =>
      E.die("Unexpected ConfigurationDAO.deleteByDungeonAndLevel call."),
    getAll: () => E.die("Unexpected ConfigurationDAO.getAll call."),
    getById: () => E.succeed(configuration),
    save: () => E.die("Unexpected ConfigurationDAO.save call."),
    saveReplacingDungeonAndLevel: () =>
      E.die("Unexpected ConfigurationDAO.saveReplacingDungeonAndLevel call."),
    update: () => E.die("Unexpected ConfigurationDAO.update call."),
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

    getHistoryByConfigurationDefinitionId: ({ configurationDefinitionId }) => {
      return E.sync(() => {
        onGetHistory?.();

        expect(configurationDefinitionId).toBe(
          MOCK_CONFIGURATION_DEFINITION_ID,
        );

        return history;
      });
    },

    observe: () => E.die("Unexpected DungeonRunObservationDAO.observe call."),
  };
}

function makeTestLayer({
  configuration = Option.some(persistedConfiguration),
  history = observations,
  onGetHistory,
}: {
  readonly configuration?: Option.Option<PersistedConfiguration>;
  readonly history?: ReadonlyArray<DungeonRunObservationHistory>;
  readonly onGetHistory?: () => void;
} = {}) {
  const ConfigurationDAOTest = Layer.succeed(
    ConfigurationDAO,
    makeConfigurationDAOTest(configuration),
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
      Layer.mergeAll(ConfigurationDAOTest, DungeonRunObservationDAOTest),
    ),
  );
}

function getDungeonRunHistory<T>(history: Option.Option<T>): T {
  if (Option.isNone(history)) {
    throw new Error("Expected dungeon run history.");
  }

  return history.value;
}

describe("DungeonRunApiServiceLive", () => {
  test("returns dungeon run history for a configuration", async () => {
    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        configurationId: MOCK_CONFIGURATION_ID,
      });

      expect(getDungeonRunHistory(result)).toEqual({
        configurationId: MOCK_CONFIGURATION_ID,
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

  test("returns none when the configuration does not exist", async () => {
    let getHistoryCallCount = 0;

    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        configurationId: MOCK_UNKNOWN_CONFIGURATION_ID,
      });

      expect(Option.isNone(result)).toBe(true);
    }).pipe(
      E.provide(
        makeTestLayer({
          configuration: Option.none(),
          onGetHistory: () => {
            getHistoryCallCount += 1;
          },
        }),
      ),
    );

    await runTest(program);

    expect(getHistoryCallCount).toBe(0);
  });

  test("returns empty history when the configuration has no observations", async () => {
    const program = E.gen(function* () {
      const dungeonRunApiService = yield* DungeonRunApiService;

      const result = yield* dungeonRunApiService.getHistory({
        configurationId: MOCK_CONFIGURATION_ID,
      });

      expect(getDungeonRunHistory(result)).toEqual({
        configurationId: MOCK_CONFIGURATION_ID,
        observations: [],
      });
    }).pipe(
      E.provide(
        makeTestLayer({
          history: [],
        }),
      ),
    );

    await runTest(program);
  });
});
