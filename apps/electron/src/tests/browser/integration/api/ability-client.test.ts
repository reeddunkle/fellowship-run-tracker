import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeAbilityCatalogMock } from "@frt/api/tests/common/mocks/ability-catalog-mock.ts";
import { type AbilityApiAbility } from "@frt/shared/ability/ability-api-schema.ts";

import {
  getAbilities,
  getAbility,
} from "@/renderer/api/ability/ability-client.ts";
import { runWithTestApiServer } from "@/tests/browser/common/run-with-test-api-server.ts";

const ABILITY_ID = "634";
const UNIT_ID = "133";
const UNKNOWN_ABILITY_ID = "999999";

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const ability = {
  createdAt: MOCK_CREATED_AT,
  id: ABILITY_ID,
  name: "Stormy Retreat",
  unitId: UNIT_ID,
  updatedAt: MOCK_UPDATED_AT,
} satisfies AbilityApiAbility;

const ApiServerTestLive = makeApiServerTestLayerWith(
  makeAbilityCatalogMock({
    getAll: () => {
      return E.succeed([ability]);
    },
    getById: ({ id }) => {
      return id === ABILITY_ID ? E.succeedSome(ability) : E.succeedNone;
    },
  }),
);

describe("ability client", () => {
  test("gets all abilities", async () => {
    const abilities = await runWithTestApiServer(
      getAbilities(),
      ApiServerTestLive,
    );

    expect(abilities).toEqual([ability]);
  });

  test("gets an ability", async () => {
    const result = await runWithTestApiServer(
      getAbility({ id: ABILITY_ID }),
      ApiServerTestLive,
    );

    expect(result).toEqual(ability);
  });

  test("returns NotFound when an ability does not exist", async () => {
    const error = await runWithTestApiServer(
      getAbility({ id: UNKNOWN_ABILITY_ID }).pipe(E.flip),
      ApiServerTestLive,
    );

    expect(error._tag).toBe("NotFound");
  });
});
