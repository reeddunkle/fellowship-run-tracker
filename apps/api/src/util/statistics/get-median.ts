import * as A from "effect/Array";
import * as Order from "effect/Order";

export function getMedian(values: ReadonlyArray<number>): number {
  const sortedValues = A.sort(values, Order.Number);

  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? 0;
  }

  const lowerValue = sortedValues[middleIndex - 1] ?? 0;
  const upperValue = sortedValues[middleIndex] ?? 0;

  return (lowerValue + upperValue) / 2;
}
