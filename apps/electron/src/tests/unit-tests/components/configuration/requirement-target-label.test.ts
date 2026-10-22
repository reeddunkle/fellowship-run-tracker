import { describe, expect, test } from "vitest";

import { getRequirementTargetLabel } from "@frt/shared/fellowship/requirements/requirement-target-label.ts";

const EMPTY_CATALOGS = {
  abilitiesById: {},
  dungeonsById: {},
  encountersById: {},
  unitsById: {},
};

describe("getRequirementTargetLabel", () => {
  test("identifies an uncatalogued unit by its raw id", () => {
    expect(
      getRequirementTargetLabel({
        ...EMPTY_CATALOGS,
        eventType: "UNIT_DEATH",
        targetId: "999",
      }),
    ).toBe("Unknown unit (ID 999)");
  });
});
