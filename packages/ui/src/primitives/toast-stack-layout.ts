import { type ToastObject } from "@base-ui/react/toast";

export type ToastData = {
  readonly size?: "compact" | "default";
  readonly stackOrder?: number;
};

type ToastStackEntry = {
  readonly index: number;
  readonly isLimited: boolean;
  readonly offsetY: number;
  readonly toast: ToastObject<ToastData>;
};

function getStackOrder(toastItem: ToastObject<ToastData>): number {
  return toastItem.data?.stackOrder ?? Number.NEGATIVE_INFINITY;
}

function compareStackOrder(
  a: ToastObject<ToastData>,
  b: ToastObject<ToastData>,
): number {
  const aOrder = getStackOrder(a);
  const bOrder = getStackOrder(b);

  if (aOrder === bOrder) {
    return 0;
  }

  return aOrder < bOrder ? -1 : 1;
}

export function getToastStackLayout(
  toasts: ReadonlyArray<ToastObject<ToastData>>,
  limit: number,
): ReadonlyArray<ToastStackEntry> {
  return [...toasts].sort(compareStackOrder).reduce<{
    readonly entries: ReadonlyArray<ToastStackEntry>;
    readonly offsetY: number;
    readonly visibleCount: number;
  }>(
    ({ entries, offsetY, visibleCount }, toastItem, position) => {
      const isEnding = toastItem.transitionStatus === "ending";

      return {
        entries: [
          ...entries,
          {
            index: isEnding ? position : visibleCount,
            isLimited: !isEnding && visibleCount >= limit,
            offsetY,
            toast: toastItem,
          },
        ],
        offsetY: offsetY + (toastItem.height ?? 0),
        visibleCount: isEnding ? visibleCount : visibleCount + 1,
      };
    },
    { entries: [], offsetY: 0, visibleCount: 0 },
  ).entries;
}
