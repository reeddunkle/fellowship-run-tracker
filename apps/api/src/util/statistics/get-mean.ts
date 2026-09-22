export function getMean(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => {
    return sum + value;
  }, 0);

  return total / values.length;
}
