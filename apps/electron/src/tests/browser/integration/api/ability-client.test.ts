import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeAbilityCatalogMock } from "@frt/api/tests/common/mocks/ability-catalog-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { type AbilityApiAbility } from "@frt/shared/ability/ability-api-schema.ts";

import {
  getAbilities,
  getAbility,
} from "@/renderer/api/ability/ability-client.ts";
import { TestAppApiClientTestLive } from "@/tests/browser/common/layers/app-api-client-test-layer.ts";

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

describe("ability client", () => {
  test("gets all abilities", async () => {
    const abilityCatalogMock = makeAbilityCatalogMock({
      getAll: () => {
        return E.succeed([ability]);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(abilityCatalogMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const abilities = yield* getAbilities();

        expect(abilities).toEqual([ability]);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("gets an ability", async () => {
    const abilityCatalogMock = makeAbilityCatalogMock({
      getById: ({ id }) => {
        if (id === ABILITY_ID) {
          return E.succeedSome(ability);
        }

        return E.succeedNone;
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(abilityCatalogMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* getAbility({
          id: ABILITY_ID,
        });

        expect(result).toEqual(ability);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("returns NotFound when an ability does not exist", async () => {
    const abilityCatalogMock = makeAbilityCatalogMock();

    const ApiServerTestLive = makeApiServerTestLayerWith(abilityCatalogMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const wasNotFound = yield* getAbility({
          id: UNKNOWN_ABILITY_ID,
        }).pipe(
          E.as(false),
          E.catchTag("NotFound", () => {
            return E.succeed(true);
          }),
        );

        expect(wasNotFound).toBe(true);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });
});
