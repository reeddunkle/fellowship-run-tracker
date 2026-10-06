import * as A from "effect/Array";
import * as Order from "effect/Order";

export function getPercentile(
  values: ReadonlyArray<number>,
  percentile: number,
): number {
  const sortedValues = A.sort(values, Order.Number);

  const rank = Math.ceil((percentile / 100) * sortedValues.length);

  return sortedValues[Math.max(rank - 1, 0)] ?? 0;
}
