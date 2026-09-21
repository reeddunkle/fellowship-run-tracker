import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, test } from "vitest";

import { type UnitApiUnit } from "@/contracts/unit/unit-api-schema.ts";
import { getUnit, getUnits } from "@/electron/renderer/api/unit/unit-client.ts";
import { makeApiServerTestLayerWith } from "@/tests/common/layers/api-server-test-layer.ts";
import { TestAppApiClientTestLive } from "@/tests/common/layers/app-api-client-test-layer.ts";
import { makeUnitApiServiceMock } from "@/tests/common/mocks/unit-api-service-mock.ts";
import { runTest } from "@/tests/common/run-test.ts";

const UNIT_ID = "42";
const UNKNOWN_UNIT_ID = "999999";

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const unit = {
  createdAt: MOCK_CREATED_AT,
  dungeonIds: ["24"],
  groupKey: null,
  id: UNIT_ID,
  name: "Desecrator",
  status: "ACTIVE",
  updatedAt: MOCK_UPDATED_AT,
  variant: null,
} satisfies UnitApiUnit;

describe("unit client", () => {
  test("gets all units", async () => {
    const unitApiServiceMock = makeUnitApiServiceMock({
      getAll: () => {
        return E.succeed([unit]);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(unitApiServiceMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      getUnits().pipe(
        E.tap((units) => {
          return E.sync(() => {
            expect(units).toEqual([unit]);
          });
        }),
        E.provide(TestLive),
      ),
    );

    await runTest(program);
  });

  test("gets a unit", async () => {
    const unitApiServiceMock = makeUnitApiServiceMock({
      getById: ({ id }) => {
        if (id === UNIT_ID) {
          return E.succeedSome(unit);
        }

        return E.succeedNone;
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(unitApiServiceMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      getUnit({
        id: UNIT_ID,
      }).pipe(
        E.tap((result) => {
          return E.sync(() => {
            expect(result).toEqual(unit);
          });
        }),
        E.provide(TestLive),
      ),
    );

    await runTest(program);
  });

  test("returns NotFound when a unit does not exist", async () => {
    const unitApiServiceMock = makeUnitApiServiceMock();

    const ApiServerTestLive = makeApiServerTestLayerWith(unitApiServiceMock);

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const wasNotFound = yield* getUnit({
          id: UNKNOWN_UNIT_ID,
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
