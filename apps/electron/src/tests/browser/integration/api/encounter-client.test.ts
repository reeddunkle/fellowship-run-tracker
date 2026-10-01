import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeEncounterCatalogMock } from "@frt/api/tests/common/mocks/encounter-catalog-mock.ts";
import { type EncounterApiEncounter } from "@frt/shared/encounter/encounter-api-schema.ts";

import {
  getEncounter,
  getEncounters,
} from "@/renderer/api/encounter/encounter-client.ts";
import { runWithTestApiServer } from "@/tests/browser/common/run-with-test-api-server.ts";

const DUNGEON_ID = "24";
const ENCOUNTER_ID = "33";
const UNKNOWN_ENCOUNTER_ID = "999999";

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const encounter = {
  createdAt: MOCK_CREATED_AT,
  dungeonId: DUNGEON_ID,
  id: ENCOUNTER_ID,
  name: "Vexira",
  updatedAt: MOCK_UPDATED_AT,
} satisfies EncounterApiEncounter;

const ApiServerTestLive = makeApiServerTestLayerWith(
  makeEncounterCatalogMock({
    getAll: () => {
      return E.succeed([encounter]);
    },
    getById: ({ dungeonId, id }) => {
      return dungeonId === DUNGEON_ID && id === ENCOUNTER_ID
        ? E.succeedSome(encounter)
        : E.succeedNone;
    },
  }),
);

describe("encounter client", () => {
  test("gets all encounters", async () => {
    const encounters = await runWithTestApiServer(
      getEncounters(),
      ApiServerTestLive,
    );

    expect(encounters).toEqual([encounter]);
  });

  test("gets an encounter", async () => {
    const result = await runWithTestApiServer(
      getEncounter({ dungeonId: DUNGEON_ID, id: ENCOUNTER_ID }),
      ApiServerTestLive,
    );

    expect(result).toEqual(encounter);
  });

  test("returns NotFound when an encounter does not exist", async () => {
    const error = await runWithTestApiServer(
      getEncounter({ dungeonId: DUNGEON_ID, id: UNKNOWN_ENCOUNTER_ID }).pipe(
        E.flip,
      ),
      ApiServerTestLive,
    );

    expect(error._tag).toBe("NotFound");
  });
});
