import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { loadEffectiveFellowshipCatalogs } from "@frt/db/catalogs/load-effective-fellowship-catalogs.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";

describe("loadEffectiveFellowshipCatalogs", () => {
  test("merges seasonal additions and patches over bundled catalogs", async () => {
    const catalogs = await runTest(loadEffectiveFellowshipCatalogs);

    expect(catalogs.dungeons).toContainEqual({
      dungeonId: "36",
      mapId: "41",
      name: "Crown of the Wild",
    });
    expect(catalogs.encounters).toContainEqual({
      dungeonId: "36",
      encounterId: "40",
      name: "Scrofa, Wild Incarnate",
    });
    expect(catalogs.units).toContainEqual(
      expect.objectContaining({
        dungeonIds: ["36"],
        id: "346",
        name: "Spear Centurion",
      }),
    );
    expect(catalogs.units).toContainEqual(
      expect.objectContaining({
        id: "313",
        name: "Elder Glacial Bear",
      }),
    );
    expect(catalogs.units).toContainEqual(
      expect.objectContaining({
        id: "182",
        name: "Slaughtervine",
      }),
    );
  });

  test("loads catalogs through an effect", async () => {
    await runTest(
      loadEffectiveFellowshipCatalogs.pipe(
        E.map((catalogs) => {
          return expect(catalogs.units.length).toBeGreaterThan(0);
        }),
      ),
    );
  });
});
