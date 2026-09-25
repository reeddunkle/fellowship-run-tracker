import { describe, expect, test } from "vitest";

import {
  centerBoundsInWorkArea,
  fitBoundsToWorkArea,
  getDefaultWindowSize,
  getMinimumWindowSize,
  getWindowAnchor,
  placeAtAnchor,
  resolveInitialWindowBounds,
} from "@/application/window-bounds.ts";

const LARGE_WORK_AREA = { height: 1400, width: 2560, x: 0, y: 0 };
const LAPTOP_WORK_AREA = { height: 860, width: 1366, x: 0, y: 0 };
const SECONDARY_WORK_AREA = { height: 1040, width: 1920, x: 2560, y: 0 };

describe("getDefaultWindowSize", () => {
  test("uses the preferred size when the work area is large enough", () => {
    expect(getDefaultWindowSize(LARGE_WORK_AREA)).toEqual({
      height: 1100,
      width: 1500,
    });
  });

  test("caps the size to a fraction of a small work area", () => {
    expect(getDefaultWindowSize(LAPTOP_WORK_AREA)).toEqual({
      height: 774,
      width: 1229,
    });
  });
});

describe("getMinimumWindowSize", () => {
  test("never exceeds the work area", () => {
    expect(
      getMinimumWindowSize({ height: 600, width: 800, x: 0, y: 0 }),
    ).toEqual({ height: 600, width: 800 });
  });
});

describe("centerBoundsInWorkArea", () => {
  test("centers within an offset secondary display", () => {
    expect(
      centerBoundsInWorkArea({ height: 400, width: 900 }, SECONDARY_WORK_AREA),
    ).toEqual({ height: 400, width: 900, x: 3070, y: 320 });
  });

  test("shrinks a window larger than the work area", () => {
    expect(
      centerBoundsInWorkArea({ height: 2000, width: 3000 }, LAPTOP_WORK_AREA),
    ).toEqual({ height: 860, width: 1366, x: 0, y: 0 });
  });
});

describe("fitBoundsToWorkArea", () => {
  test("moves a window that grew past the bottom edge back on screen", () => {
    expect(
      fitBoundsToWorkArea(
        { height: 600, width: 900, x: 2800, y: 700 },
        SECONDARY_WORK_AREA,
      ),
    ).toEqual({ height: 600, width: 900, x: 2800, y: 440 });
  });

  test("leaves a window that already fits untouched", () => {
    const bounds = { height: 600, width: 900, x: 2800, y: 100 };

    expect(fitBoundsToWorkArea(bounds, SECONDARY_WORK_AREA)).toEqual(bounds);
  });
});

describe("getWindowAnchor", () => {
  test.each([
    {
      bounds: { height: 400, width: 900, x: 2570, y: 10 },
      expected: { horizontal: "left", vertical: "top", x: 2570, y: 10 },
    },
    {
      bounds: { height: 400, width: 900, x: 3570, y: 10 },
      expected: { horizontal: "right", vertical: "top", x: 4470, y: 10 },
    },
    {
      bounds: { height: 400, width: 900, x: 2570, y: 630 },
      expected: { horizontal: "left", vertical: "bottom", x: 2570, y: 1030 },
    },
    {
      bounds: { height: 400, width: 900, x: 3570, y: 630 },
      expected: { horizontal: "right", vertical: "bottom", x: 4470, y: 1030 },
    },
  ])(
    "anchors to the nearest corner at $expected.horizontal/$expected.vertical",
    ({ bounds, expected }) => {
      expect(getWindowAnchor(bounds, SECONDARY_WORK_AREA)).toEqual(expected);
    },
  );

  test("prefers the top-left corner when centered", () => {
    expect(
      getWindowAnchor(
        { height: 400, width: 900, x: 3070, y: 320 },
        SECONDARY_WORK_AREA,
      ),
    ).toEqual({ horizontal: "left", vertical: "top", x: 3070, y: 320 });
  });
});

describe("placeAtAnchor", () => {
  const bottomRightAnchor = {
    horizontal: "right",
    vertical: "bottom",
    x: 4480,
    y: 1040,
  } as const;

  test("keeps the anchored corner fixed as the window grows", () => {
    expect(
      placeAtAnchor({ height: 700, width: 1000 }, bottomRightAnchor),
    ).toEqual({ height: 700, width: 1000, x: 3480, y: 340 });
  });

  test("stays within the work area when the window outgrows it", () => {
    expect(
      fitBoundsToWorkArea(
        placeAtAnchor({ height: 1200, width: 1000 }, bottomRightAnchor),
        SECONDARY_WORK_AREA,
      ),
    ).toEqual({ height: 1040, width: 1000, x: 3480, y: 0 });
  });
});

describe("resolveInitialWindowBounds", () => {
  test("falls back to a centered default size without saved bounds", () => {
    expect(
      resolveInitialWindowBounds({
        defaultWorkArea: LAPTOP_WORK_AREA,
        savedBounds: undefined,
        workAreas: [LAPTOP_WORK_AREA],
      }),
    ).toEqual({ height: 774, width: 1229 });
  });

  test("restores saved bounds that are on a connected display", () => {
    const savedBounds = { height: 900, width: 1200, x: 2700, y: 50 };

    expect(
      resolveInitialWindowBounds({
        defaultWorkArea: LARGE_WORK_AREA,
        savedBounds,
        workAreas: [LARGE_WORK_AREA, SECONDARY_WORK_AREA],
      }),
    ).toEqual(savedBounds);
  });

  test("falls back to the default when the saved display is disconnected", () => {
    expect(
      resolveInitialWindowBounds({
        defaultWorkArea: LARGE_WORK_AREA,
        savedBounds: { height: 900, width: 1200, x: 2700, y: 50 },
        workAreas: [LARGE_WORK_AREA],
      }),
    ).toEqual({ height: 1100, width: 1500 });
  });

  test("shrinks and moves saved bounds to fit a smaller work area", () => {
    expect(
      resolveInitialWindowBounds({
        defaultWorkArea: LAPTOP_WORK_AREA,
        savedBounds: { height: 1100, width: 1500, x: 200, y: 100 },
        workAreas: [LAPTOP_WORK_AREA],
      }),
    ).toEqual({ height: 860, width: 1366, x: 0, y: 0 });
  });
});
