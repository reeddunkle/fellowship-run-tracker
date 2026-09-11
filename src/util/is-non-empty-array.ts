export function isNonEmptyArray<T>(
  values: ReadonlyArray<T>,
): values is readonly [T, ...T[]] {
  return values.length > 0;
}
