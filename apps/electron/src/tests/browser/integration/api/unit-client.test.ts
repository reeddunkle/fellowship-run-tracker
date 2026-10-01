import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeUnitCatalogMock } from "@frt/api/tests/common/mocks/unit-catalog-mock.ts";
import { type UnitApiUnit } from "@frt/shared/unit/unit-api-schema.ts";

import { getUnit, getUnits } from "@/renderer/api/unit/unit-client.ts";
import { runWithTestApiServer } from "@/tests/browser/common/run-with-test-api-server.ts";

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

const ApiServerTestLive = makeApiServerTestLayerWith(
  makeUnitCatalogMock({
    getAll: () => {
      return E.succeed([unit]);
    },
    getById: ({ id }) => {
      return id === UNIT_ID ? E.succeedSome(unit) : E.succeedNone;
    },
  }),
);

describe("unit client", () => {
  test("gets all units", async () => {
    const units = await runWithTestApiServer(getUnits(), ApiServerTestLive);

    expect(units).toEqual([unit]);
  });

  test("gets a unit", async () => {
    const result = await runWithTestApiServer(
      getUnit({ id: UNIT_ID }),
      ApiServerTestLive,
    );

    expect(result).toEqual(unit);
  });

  test("returns NotFound when a unit does not exist", async () => {
    const error = await runWithTestApiServer(
      getUnit({ id: UNKNOWN_UNIT_ID }).pipe(E.flip),
      ApiServerTestLive,
    );

    expect(error._tag).toBe("NotFound");
  });
});
