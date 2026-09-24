import { describe, expect, test } from "vitest";

import { getToastStackLayout } from "@frt/ui/toast-stack-layout.ts";

type StackedToast = Parameters<typeof getToastStackLayout>[0][number];

function makeToast(
  id: string,
  {
    height = 50,
    stackOrder,
    transitionStatus,
  }: {
    readonly height?: number;
    readonly stackOrder?: number;
    readonly transitionStatus?: StackedToast["transitionStatus"];
  } = {},
): StackedToast {
  return {
    data: stackOrder === undefined ? {} : { stackOrder },
    height,
    id,
    transitionStatus,
  };
}

function summarize(layout: ReturnType<typeof getToastStackLayout>) {
  return layout.map(({ index, isLimited, offsetY, toast }) => {
    return { id: toast.id, index, isLimited, offsetY };
  });
}

describe("getToastStackLayout", () => {
  test("orders the stack by stackOrder, with unordered toasts in front", () => {
    const layout = getToastStackLayout(
      [
        makeToast("third", { stackOrder: 2 }),
        makeToast("first", { stackOrder: 0 }),
        makeToast("plain"),
        makeToast("second", { height: 30, stackOrder: 1 }),
      ],
      10,
    );

    expect(summarize(layout)).toEqual([
      { id: "plain", index: 0, isLimited: false, offsetY: 0 },
      { id: "first", index: 1, isLimited: false, offsetY: 50 },
      { id: "second", index: 2, isLimited: false, offsetY: 100 },
      { id: "third", index: 3, isLimited: false, offsetY: 130 },
    ]);
  });

  test("limits toasts past the limit without counting closing toasts", () => {
    const layout = getToastStackLayout(
      [
        makeToast("a", { stackOrder: 0 }),
        makeToast("closing", { stackOrder: 1, transitionStatus: "ending" }),
        makeToast("b", { stackOrder: 2 }),
        makeToast("c", { stackOrder: 3 }),
      ],
      2,
    );

    expect(summarize(layout)).toEqual([
      { id: "a", index: 0, isLimited: false, offsetY: 0 },
      { id: "closing", index: 1, isLimited: false, offsetY: 50 },
      { id: "b", index: 1, isLimited: false, offsetY: 100 },
      { id: "c", index: 2, isLimited: true, offsetY: 150 },
    ]);
  });
});
